import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getLatestMetrics } from '../metrics/metrics.service.js';
import { buildAudienceReachFromMetrics, getAudienceReachStatus } from './audience-reach.model.js';

export function getAudienceReachStatusController(_req: Request, res: Response) {
  return res.json(ok(getAudienceReachStatus()));
}

export async function getAudienceReachReportController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const metrics = await getLatestMetrics(auth?.workspaceId, auth?.userId);
    return res.json(ok(buildAudienceReachFromMetrics(metrics)));
  } catch (error) {
    return next(error);
  }
}
