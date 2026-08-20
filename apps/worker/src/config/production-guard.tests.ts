import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEV_ONLY_WORKER_SHARED_SECRET } from './env.js';
import {
  assertWorkerProductionSafeStartup,
  getWorkerProductionSecurityChecks,
  type WorkerSecurityInput,
} from './production-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STRONG_SECRET = 'a'.repeat(64);

function input(overrides: Partial<WorkerSecurityInput> = {}): WorkerSecurityInput {
  return {
    nodeEnv: 'production',
    workerSharedSecret: STRONG_SECRET,
    workerSharedSecretSource: 'environment',
    workerEnabled: true,
    workerEnabledExplicit: true,
    workerApiBaseUrl: 'https://api.example.com',
    allowInsecureProductionStartup: false,
    ...overrides,
  };
}

function criticalFailures(config: WorkerSecurityInput): string[] {
  return getWorkerProductionSecurityChecks(config)
    .filter((check) => check.severity === 'critical' && !check.ok)
    .map((check) => check.key);
}

function spawnWorker(env: NodeJS.ProcessEnv): Promise<{ code: number | null; output: string }> {
  const workerEntrypoint = path.resolve(__dirname, '../worker.js');
  assert(fs.existsSync(workerEntrypoint), `Build the worker first: ${workerEntrypoint} is missing (npm --workspace apps/worker run build).`);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerEntrypoint, '--status'], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.stderr.on('data', (chunk) => { output += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

async function main() {
  // --- Unit level: the checks themselves -------------------------------------------------

  assert.deepEqual(criticalFailures(input()), [], 'A strong, explicitly configured secret must produce no critical failure.');
  assert.doesNotThrow(() => assertWorkerProductionSafeStartup(input()), 'A production worker with a strong secret must start.');

  assert.deepEqual(
    criticalFailures(input({ workerSharedSecret: DEV_ONLY_WORKER_SHARED_SECRET })),
    ['worker_shared_secret'],
    'The published development-only secret must be a critical failure.',
  );
  assert.throws(
    () => assertWorkerProductionSafeStartup(input({ workerSharedSecret: DEV_ONLY_WORKER_SHARED_SECRET })),
    /Worker production startup blocked by security checks/,
    'Production startup must be blocked when the development-only secret is used.',
  );

  assert.throws(
    () => assertWorkerProductionSafeStartup(input({ workerSharedSecret: '', workerSharedSecretSource: 'missing' })),
    /WORKER_SHARED_SECRET is missing/,
    'Production startup must be blocked when WORKER_SHARED_SECRET is absent.',
  );

  assert.throws(
    () => assertWorkerProductionSafeStartup(input({ workerSharedSecret: 'short_but_random_1234' })),
    /Worker production startup blocked by security checks/,
    'Production startup must be blocked when the secret is shorter than the 40 characters the API requires.',
  );

  assert.throws(
    () => assertWorkerProductionSafeStartup(input({ workerSharedSecret: `replace_with_${'x'.repeat(60)}` })),
    /Worker production startup blocked by security checks/,
    'Production startup must be blocked when the secret still carries a placeholder marker.',
  );

  // Outside production the same weak secret only warns.
  assert.doesNotThrow(
    () => assertWorkerProductionSafeStartup(input({ nodeEnv: 'development', workerSharedSecret: DEV_ONLY_WORKER_SHARED_SECRET, workerSharedSecretSource: 'development_fallback' })),
    'Development must keep working with the development fallback secret.',
  );

  // Documented escape hatch, same name and semantics as the API guard.
  assert.doesNotThrow(
    () => assertWorkerProductionSafeStartup(input({ workerSharedSecret: DEV_ONLY_WORKER_SHARED_SECRET, allowInsecureProductionStartup: true })),
    'ALLOW_INSECURE_PRODUCTION_STARTUP=true must downgrade production checks to warnings, exactly like the API.',
  );

  // WORKER_ENABLED must be surfaced, but must never block startup.
  const unsetWorkerEnabled = getWorkerProductionSecurityChecks(input({ workerEnabled: false, workerEnabledExplicit: false }))
    .find((check) => check.key === 'worker_enabled');
  assert(unsetWorkerEnabled, 'A worker_enabled check must exist.');
  assert.equal(unsetWorkerEnabled.ok, false, 'An unset WORKER_ENABLED must be reported as a finding.');
  assert.equal(unsetWorkerEnabled.severity, 'warning', 'An unset WORKER_ENABLED must warn, not block: the default is unchanged on purpose.');
  assert.doesNotThrow(
    () => assertWorkerProductionSafeStartup(input({ workerEnabled: false, workerEnabledExplicit: false })),
    'An unset WORKER_ENABLED must not block production startup.',
  );

  // --- End to end: the real process must actually refuse to start -------------------------

  const weakSecretRun = await spawnWorker({
    NODE_ENV: 'production',
    WORKER_SHARED_SECRET: DEV_ONLY_WORKER_SHARED_SECRET,
    ALLOW_INSECURE_PRODUCTION_STARTUP: 'false',
    WORKER_API_BASE_URL: 'https://api.invalid.example.com',
  });
  assert.notEqual(weakSecretRun.code, 0, `The worker process must exit non-zero with a weak secret in production. Output:\n${weakSecretRun.output}`);
  assert.match(weakSecretRun.output, /Worker production startup blocked by security checks/, `The worker must say why it refused to start. Output:\n${weakSecretRun.output}`);
  assert.doesNotMatch(weakSecretRun.output, /api\.invalid\.example\.com\/api\/v1\/worker\/status/, 'The worker must refuse before contacting the API.');

  const missingSecretRun = await spawnWorker({
    NODE_ENV: 'production',
    WORKER_SHARED_SECRET: '',
    ALLOW_INSECURE_PRODUCTION_STARTUP: 'false',
    WORKER_API_BASE_URL: 'https://api.invalid.example.com',
  });
  assert.notEqual(missingSecretRun.code, 0, `The worker process must exit non-zero with no secret in production. Output:\n${missingSecretRun.output}`);
  assert.match(missingSecretRun.output, /WORKER_SHARED_SECRET is missing/, `The worker must name the missing variable. Output:\n${missingSecretRun.output}`);

  console.log('Worker production guard tests passed.');
}

main().catch((error) => {
  console.error('Worker production guard tests failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
