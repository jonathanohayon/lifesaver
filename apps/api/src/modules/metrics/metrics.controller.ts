import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getLatestMetrics } from './metrics.service.js';

export async function getMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const metrics = await getLatestMetrics(auth?.workspaceId, auth?.userId);
    return res.json(ok(metrics));
  } catch (error) {
    return next(error);
  }
}
