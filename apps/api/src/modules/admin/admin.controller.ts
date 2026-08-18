import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getAdminOverview, getAdminOperationsLog } from './admin.service.js';

export async function getAdminOverviewController(_req: Request, res: Response, next: NextFunction) {
  try {
    const overview = await getAdminOverview();
    return res.json(ok(overview));
  } catch (error) {
    return next(error);
  }
}


export async function adminOperationsLogController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 25;
    const result = await getAdminOperationsLog(auth.workspaceId, limit);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}
