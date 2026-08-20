import { workerEnv } from './config/env.js';
import { assertWorkerProductionSafeStartup } from './config/production-guard.js';
import { getWorkerStatus, runWorkerJob, type WorkerJobName } from './jobs/worker-api-client.js';
import { startScheduler } from './scheduler.js';

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

async function main() {
  // Runs before any command path: --once and --status also send WORKER_SHARED_SECRET to the API.
  assertWorkerProductionSafeStartup();

  const once = argValue('once') as WorkerJobName | null;
  const dryRun = process.argv.includes('--dry-run');

  console.log('[LIFE.SAVER worker] Starting v0.6.0 Phase 2.4 payload schema worker compatibility mode.');
  console.log('[LIFE.SAVER worker] API:', workerEnv.WORKER_API_BASE_URL);

  if (once) {
    const valid = new Set(['metrics_refresh', 'daily_brief', 'weekly_summary', 'daily_pipeline', 'weekly_pipeline']);
    if (!valid.has(once)) {
      console.error(`[LIFE.SAVER worker] Unknown --once job: ${once}`);
      process.exitCode = 1;
      return;
    }

    const result = await runWorkerJob(once, { dryRun });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (process.argv.includes('--status')) {
    const status = await getWorkerStatus();
    console.log(JSON.stringify(status, null, 2));
    process.exitCode = 0;
    return;
  }

  startScheduler();
}

main().catch((error) => {
  console.error('[LIFE.SAVER worker] Fatal error:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
