import { env } from '../../config/env.js';
import { generateDailyBrief, generateWeeklySummary } from '../briefs/briefs.service.js';
import { refreshTripleWhaleMetrics } from '../triple-whale/triple-whale.service.js';
import { resolveWorkerTarget, recordWorkerEvent } from './worker.repository.js';

export type WorkerJobName = 'metrics_refresh' | 'daily_brief' | 'weekly_summary' | 'daily_pipeline' | 'weekly_pipeline';

export type WorkerRunResult = {
  ok: boolean;
  job: WorkerJobName;
  version: string;
  dryRun: boolean;
  workerEnabled: boolean;
  startedAt: string;
  completedAt: string;
  target: {
    workspaceId: string;
    userId: string;
    workspaceName: string | null;
    userEmail: string | null;
  };
  steps: Array<{
    name: string;
    ok: boolean;
    message: string;
    data?: unknown;
  }>;
  message: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function briefSummary(data: any) {
  if (!data) return null;
  return {
    type: data.type,
    source: data.source,
    sourceStatus: data.sourceStatus,
    productionReady: data.productionReady,
    sourceSnapshotId: data.sourceSnapshotId,
    generatedAt: data.generatedAt,
    contentPreview: typeof data.content === 'string' ? data.content.slice(0, 260) : null,
  };
}

function metricsSummary(data: any) {
  if (!data) return null;
  const metrics = data.metrics || data.normalizedMetrics || data;
  return {
    status: data.status || null,
    message: data.message || null,
    snapshotId: data.snapshotId || data.id || null,
    sourceStatus: metrics.sourceStatus || null,
    productionReady: metrics.productionReady || false,
    revenue: metrics.revenue ?? null,
    orders: metrics.orders ?? null,
    adSpend: metrics.adSpend ?? null,
    roas: metrics.roas ?? null,
  };
}

export function getWorkerStatus() {
  return {
    version: '0.6.0',
    workerEnabled: env.WORKER_ENABLED,
    schedulerActive: Boolean(env.WORKER_ENABLED),
    automaticJobs: {
      metricsRefresh: 'read-only Triple Whale refresh',
      dailyBrief: 'read-only metrics refresh + internal Daily Brief generation',
      weeklySummary: 'read-only metrics refresh + internal Weekly Summary generation',
    },
    workerTimezone: env.WORKER_TIMEZONE,
    cron: {
      metricsRefresh: env.WORKER_METRICS_CRON,
      dailyBrief: env.WORKER_DAILY_BRIEF_CRON,
      weeklySummary: env.WORKER_WEEKLY_SUMMARY_CRON,
    },
    safety: 'Worker can refresh read-only Triple Whale metrics and generate internal briefs only. It cannot post, send, refund, or change external systems.',
    secretConfigured: Boolean(env.WORKER_SHARED_SECRET),
  };
}

export async function runWorkerJob(job: WorkerJobName, options: { dryRun?: boolean } = {}): Promise<WorkerRunResult> {
  const startedAt = nowIso();
  const dryRun = Boolean(options.dryRun);
  const target = await resolveWorkerTarget();
  const steps: WorkerRunResult['steps'] = [];

  await recordWorkerEvent({
    workspaceId: target.workspaceId,
    eventType: `worker_${job}_started`,
    message: `Worker job ${job} started.`,
    severity: 'info',
    metadata: { version: '0.6.0', dryRun, target },
  });

  try {
    if (dryRun) {
      steps.push({ name: job, ok: true, message: 'Dry run only. No metrics refresh or brief insert was performed.' });
    } else {
      if (job === 'metrics_refresh' || job === 'daily_pipeline' || job === 'weekly_pipeline') {
        const metrics = await refreshTripleWhaleMetrics(target.workspaceId, target.userId);
        steps.push({ name: 'metrics_refresh', ok: true, message: 'Read-only Triple Whale metrics refresh completed.', data: metricsSummary(metrics) });
      }

      if (job === 'daily_brief' || job === 'daily_pipeline') {
        const daily = await generateDailyBrief(target.workspaceId, target.userId);
        steps.push({ name: 'daily_brief', ok: true, message: 'Daily Brief generated and stored.', data: briefSummary(daily) });
      }

      if (job === 'weekly_summary' || job === 'weekly_pipeline') {
        const weekly = await generateWeeklySummary(target.workspaceId, target.userId);
        steps.push({ name: 'weekly_summary', ok: true, message: 'Weekly Summary generated and stored.', data: briefSummary(weekly) });
      }
    }

    const completedAt = nowIso();
    const result: WorkerRunResult = {
      ok: true,
      job,
      version: '0.6.0',
      dryRun,
      workerEnabled: env.WORKER_ENABLED,
      startedAt,
      completedAt,
      target,
      steps,
      message: `Worker job ${job} completed safely.`,
    };

    await recordWorkerEvent({
      workspaceId: target.workspaceId,
      eventType: `worker_${job}_completed`,
      message: result.message,
      severity: 'info',
      metadata: result,
    });

    return result;
  } catch (error) {
    const completedAt = nowIso();
    const message = error instanceof Error ? error.message : 'Worker job failed.';
    steps.push({ name: job, ok: false, message });

    const result: WorkerRunResult = {
      ok: false,
      job,
      version: '0.6.0',
      dryRun,
      workerEnabled: env.WORKER_ENABLED,
      startedAt,
      completedAt,
      target,
      steps,
      message,
    };

    await recordWorkerEvent({
      workspaceId: target.workspaceId,
      eventType: `worker_${job}_failed`,
      message,
      severity: 'error',
      metadata: result,
    });

    return result;
  }
}
