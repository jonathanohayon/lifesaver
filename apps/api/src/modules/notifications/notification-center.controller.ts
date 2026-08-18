import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getNotificationCenter } from './notification-center.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

export async function getNotificationCenterController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const data = await getNotificationCenter({
      workspaceId: current.workspaceId,
      userId: current.userId,
      pendingLimit: req.query.pendingLimit,
      eventLimit: req.query.eventLimit,
    });
    return res.json(ok(data));
  } catch (error) {
    return next(error);
  }
}
