import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildNotificationQaReport, buildNotificationQaStatus } from './notification-qa.model.js';

export function getNotificationQaStatus(_req: Request, res: Response) {
  return res.json(ok(buildNotificationQaStatus()));
}

export function getNotificationQaReport(req: Request, res: Response, next: NextFunction) {
  try {
    const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined;
    const actionId = typeof req.query.actionId === 'string' ? req.query.actionId : undefined;
    const appBaseUrl = typeof req.query.appBaseUrl === 'string' ? req.query.appBaseUrl : null;
    return res.json(ok(buildNotificationQaReport({ workspaceId, actionId, appBaseUrl })));
  } catch (error) {
    return next(error);
  }
}
