import { DEV_ONLY_WORKER_SHARED_SECRET, workerEnv, type WorkerSharedSecretSource } from './env.js';

// Same list, same helper, same thresholds as apps/api/src/config/production-guard.ts.
// The two processes must agree on what "weak" means: the API refuses to boot with a weak
// WORKER_SHARED_SECRET, and the worker must not be the half of the pair that keeps going.
const weakOrDefaultSecretSnippets = [
  'dev_only',
  'temporary_dev_key',
  'change_before_production',
  'change_later',
  'replace_with',
];

function looksWeak(value: string | undefined | null, minLength = 32): boolean {
  if (!value || value.length < minLength) return true;
  return weakOrDefaultSecretSnippets.some((snippet) => value.includes(snippet));
}

function isLocalUrl(value: string): boolean {
  return value.includes('localhost') || value.includes('127.0.0.1');
}

export type WorkerSecurityCheck = {
  key: string;
  ok: boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
};

export type WorkerSecurityInput = {
  nodeEnv: string;
  workerSharedSecret: string;
  workerSharedSecretSource: WorkerSharedSecretSource;
  workerEnabled: boolean;
  workerEnabledExplicit: boolean;
  workerApiBaseUrl: string;
  allowInsecureProductionStartup: boolean;
};

export function currentWorkerSecurityInput(): WorkerSecurityInput {
  return {
    nodeEnv: workerEnv.NODE_ENV,
    workerSharedSecret: workerEnv.WORKER_SHARED_SECRET,
    workerSharedSecretSource: workerEnv.WORKER_SHARED_SECRET_SOURCE,
    workerEnabled: workerEnv.WORKER_ENABLED,
    workerEnabledExplicit: workerEnv.WORKER_ENABLED_EXPLICIT,
    workerApiBaseUrl: workerEnv.WORKER_API_BASE_URL,
    allowInsecureProductionStartup: workerEnv.ALLOW_INSECURE_PRODUCTION_STARTUP,
  };
}

const FIX_SECRET_HINT =
  'Set WORKER_SHARED_SECRET to the same 64+ random character value configured on the API before deploying the worker.';

export function getWorkerProductionSecurityChecks(
  input: WorkerSecurityInput = currentWorkerSecurityInput(),
): WorkerSecurityCheck[] {
  const isProd = input.nodeEnv === 'production';
  const secretIsMissing = input.workerSharedSecretSource === 'missing' || input.workerSharedSecret.trim() === '';
  const secretIsDevFallback = input.workerSharedSecretSource === 'development_fallback';
  const secretIsKnownDevValue = input.workerSharedSecret === DEV_ONLY_WORKER_SHARED_SECRET;
  const secretWeak = looksWeak(input.workerSharedSecret, 40);

  const secretMessage = secretIsMissing
    ? `WORKER_SHARED_SECRET is missing. ${FIX_SECRET_HINT}`
    : secretIsKnownDevValue
      ? `WORKER_SHARED_SECRET is the public development-only value. It is published in this repository and grants access to internal worker endpoints. ${FIX_SECRET_HINT}`
      : secretWeak
        ? `WORKER_SHARED_SECRET looks weak/default (fewer than 40 characters, or contains a placeholder marker). ${FIX_SECRET_HINT}`
        : 'WORKER_SHARED_SECRET length/shape looks acceptable.';

  return [
    {
      key: 'node_env',
      ok: isProd,
      severity: isProd ? 'info' : 'warning',
      message: isProd
        ? 'NODE_ENV is production.'
        : 'NODE_ENV is not production; production-only hardening is not fully enforced.',
    },
    {
      key: 'worker_shared_secret',
      ok: !secretWeak,
      severity: 'critical',
      message: secretMessage,
    },
    {
      key: 'worker_shared_secret_source',
      ok: !secretIsDevFallback,
      severity: secretIsDevFallback ? 'warning' : 'info',
      message: secretIsDevFallback
        ? 'WORKER_SHARED_SECRET is not set; the worker fell back to the public development-only value. This is acceptable only for local development.'
        : `WORKER_SHARED_SECRET source: ${input.workerSharedSecretSource}.`,
    },
    {
      key: 'worker_enabled',
      ok: input.workerEnabledExplicit,
      severity: input.workerEnabledExplicit ? 'info' : 'warning',
      message: input.workerEnabledExplicit
        ? `WORKER_ENABLED=${input.workerEnabled} (explicitly configured).`
        : 'WORKER_ENABLED is not set. The worker defaults to false, so no job will ever be scheduled. Set WORKER_ENABLED=true to schedule jobs, or WORKER_ENABLED=false to confirm this deployment is intentionally idle.',
    },
    {
      key: 'worker_api_base_url',
      ok: !isProd || (!isLocalUrl(input.workerApiBaseUrl) && input.workerApiBaseUrl.startsWith('https://')),
      severity: isProd ? 'warning' : 'info',
      message: `WORKER_API_BASE_URL=${input.workerApiBaseUrl}. In production it should be an HTTPS, non-localhost API URL: the shared secret travels in the x-lifesaver-worker-secret header on every request.`,
    },
  ];
}

function logNonCriticalFindings(checks: WorkerSecurityCheck[]): void {
  for (const check of checks) {
    if (check.severity === 'warning' && !check.ok) {
      console.warn(`[LIFE.SAVER worker security] ${check.key}: ${check.message}`);
    }
  }
}

/**
 * Mirrors apps/api/src/config/production-guard.ts:assertProductionSafeStartup.
 *
 * Production with a weak/missing WORKER_SHARED_SECRET throws, which stops the worker before it
 * sends that secret anywhere. Outside production the same problems are reported as warnings.
 *
 * ALLOW_INSECURE_PRODUCTION_STARTUP is honoured on purpose, with the same name and the same
 * warning-only semantics as the API: a single documented escape hatch for both processes is
 * safer than a worker that refuses where the API was told to continue.
 */
export function assertWorkerProductionSafeStartup(
  input: WorkerSecurityInput = currentWorkerSecurityInput(),
): void {
  const checks = getWorkerProductionSecurityChecks(input);
  logNonCriticalFindings(checks);

  if (input.nodeEnv !== 'production') {
    const devFindings = checks.filter((check) => check.severity === 'critical' && !check.ok);
    for (const check of devFindings) {
      console.warn(`[LIFE.SAVER worker security] ${check.key}: ${check.message}`);
    }
    return;
  }

  if (input.allowInsecureProductionStartup) {
    console.warn('[LIFE.SAVER worker security] ALLOW_INSECURE_PRODUCTION_STARTUP=true. Production safety checks are warning-only. Do not use this for real client traffic.');
    for (const check of checks.filter((check) => check.severity === 'critical' && !check.ok)) {
      console.warn(`[LIFE.SAVER worker security] ${check.key}: ${check.message}`);
    }
    return;
  }

  const failed = checks.filter((check) => check.severity === 'critical' && !check.ok);
  if (failed.length) {
    const text = failed.map((check) => `- ${check.key}: ${check.message}`).join('\n');
    throw new Error(`Worker production startup blocked by security checks:\n${text}\nSet secure environment variables before production deployment.`);
  }
}
