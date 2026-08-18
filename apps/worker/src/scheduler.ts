import cron from 'node-cron';
import { workerEnv } from './config/env.js';
import { runWorkerJob, type WorkerJobName } from './jobs/worker-api-client.js';

async function safelyRun(job: WorkerJobName) {
  const startedAt = new Date().toISOString();
  console.log(`[LIFE.SAVER worker] ${startedAt} Starting ${job}…`);
  try {
    const result = await runWorkerJob(job);
    console.log(`[LIFE.SAVER worker] ${job} completed`, JSON.stringify({ ok: result.ok, message: result.message, steps: result.steps?.map((s: any) => ({ name: s.name, ok: s.ok, message: s.message })) }, null, 2));
  } catch (error) {
    console.error(`[LIFE.SAVER worker] ${job} failed`, error instanceof Error ? error.message : error);
  }
}

export function startScheduler() {
  console.log('[LIFE.SAVER worker] Scheduler configuration:', JSON.stringify({
    workerEnabled: workerEnv.WORKER_ENABLED,
    apiBaseUrl: workerEnv.WORKER_API_BASE_URL,
    timezone: workerEnv.WORKER_TIMEZONE,
    metricsCron: workerEnv.WORKER_METRICS_CRON,
    dailyBriefCron: workerEnv.WORKER_DAILY_BRIEF_CRON,
    weeklySummaryCron: workerEnv.WORKER_WEEKLY_SUMMARY_CRON,
  }, null, 2));

  if (!workerEnv.WORKER_ENABLED) {
    console.log('[LIFE.SAVER worker] WORKER_ENABLED=false. Scheduler is not active. Use npm.cmd run worker:once:daily or set WORKER_ENABLED=true.');
    return;
  }

  cron.schedule(workerEnv.WORKER_METRICS_CRON, () => safelyRun('metrics_refresh'), { timezone: workerEnv.WORKER_TIMEZONE });
  cron.schedule(workerEnv.WORKER_DAILY_BRIEF_CRON, () => safelyRun('daily_pipeline'), { timezone: workerEnv.WORKER_TIMEZONE });
  cron.schedule(workerEnv.WORKER_WEEKLY_SUMMARY_CRON, () => safelyRun('weekly_pipeline'), { timezone: workerEnv.WORKER_TIMEZONE });

  console.log('[LIFE.SAVER worker] Scheduler active. V1 worker jobs are read-only/advisory only.');
}
