import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getCustomerSettings, updateWorkspaceProfile } from './customer-settings.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole: string };
}

export async function getCustomerSettingsController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = auth(req);
    const data = await getCustomerSettings(payload.workspaceId, payload.userId);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function updateWorkspaceProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = auth(req);
    const data = await updateWorkspaceProfile(payload.workspaceId, payload.userId, req.body);
    res.json(ok({
      ...data,
      message: 'Workspace profile updated. Settings remain scoped to this customer workspace.',
    }));
  } catch (error) {
    next(error);
  }
}
