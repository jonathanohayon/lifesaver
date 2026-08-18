import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getAutonomyStatusForCurrentWorkspace, pauseAutonomyForCurrentWorkspace, resumeAutonomyForCurrentWorkspace } from './autonomy.service.js';
import { parseAutonomyPauseBody } from './autonomy.validation.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

export async function getAutonomyStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const result = await getAutonomyStatusForCurrentWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
    });
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function pauseAutonomyController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const body = parseAutonomyPauseBody(req.body);
    const result = await pauseAutonomyForCurrentWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
      scope: body.scope,
      reason: body.reason,
    });
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}

export async function resumeAutonomyController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const body = parseAutonomyPauseBody(req.body);
    const result = await resumeAutonomyForCurrentWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
      scope: body.scope,
      reason: body.reason,
    });
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}
