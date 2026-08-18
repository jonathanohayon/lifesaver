import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';
import { getWorkerStatusController, runWorkerJobController } from './worker.controller.js';

function workerSecretRequired(req: Request, _res: Response, next: NextFunction) {
  const supplied = req.header('x-lifesaver-worker-secret') || '';
  if (!env.WORKER_SHARED_SECRET || supplied !== env.WORKER_SHARED_SECRET) {
    return next(new AppError(401, 'WORKER_UNAUTHORIZED', 'Worker endpoint requires a valid internal worker secret.'));
  }
  return next();
}

export const workerRouter = Router();
workerRouter.use(workerSecretRequired);
workerRouter.get('/status', getWorkerStatusController);
workerRouter.post('/run/:job', runWorkerJobController);
