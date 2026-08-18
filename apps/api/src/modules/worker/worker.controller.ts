import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { AppError } from '../../common/errors/AppError.js';
import { getWorkerStatus, runWorkerJob, type WorkerJobName } from './worker.service.js';

const allowedJobs = new Set<WorkerJobName>(['metrics_refresh', 'daily_brief', 'weekly_summary', 'daily_pipeline', 'weekly_pipeline']);

export async function getWorkerStatusController(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(getWorkerStatus()));
  } catch (error) {
    return next(error);
  }
}

export async function runWorkerJobController(req: Request, res: Response, next: NextFunction) {
  try {
    const job = String(req.params.job || '') as WorkerJobName;
    if (!allowedJobs.has(job)) {
      throw new AppError(400, 'UNKNOWN_WORKER_JOB', 'Unknown worker job requested.');
    }

    const dryRun = Boolean(req.body?.dryRun);
    const result = await runWorkerJob(job, { dryRun });
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}
