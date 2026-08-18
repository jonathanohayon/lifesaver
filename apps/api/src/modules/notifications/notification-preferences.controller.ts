import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getNotificationPreferences, updateNotificationPreferences } from './notification-preferences.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole: string };
}

export async function getNotificationPreferencesController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = auth(req);
    const data = await getNotificationPreferences(payload.workspaceId, payload.userId);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function updateNotificationPreferencesController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = auth(req);
    const data = await updateNotificationPreferences(payload.workspaceId, payload.userId, req.body);
    res.json(ok({
      ...data,
      message: 'Notification preferences updated. Phase 10.1 stores settings only; no email, Slack, or in-app notification delivery was triggered.',
    }));
  } catch (error) {
    next(error);
  }
}
