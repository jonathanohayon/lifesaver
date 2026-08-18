import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getWorkspaceListForUser } from './workspaces.service.js';

export async function listWorkspacesController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await getWorkspaceListForUser(auth.userId, auth.workspaceId);
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function currentWorkspaceController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const result = await getWorkspaceListForUser(auth.userId, auth.workspaceId);
    return res.json(ok(result.current));
  } catch (error) {
    return next(error);
  }
}
