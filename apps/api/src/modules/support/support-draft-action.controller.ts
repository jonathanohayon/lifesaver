import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportDraftActionExample,
  buildSupportDraftActionStatus,
} from './support-draft-action.model.js';
import { createSupportDraftProposedAction, previewSupportDraftAction } from './support-draft-action.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

export function getSupportDraftActionStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportDraftActionStatus()));
}

export function getSupportDraftActionExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportDraftActionExample()));
}

export function previewSupportDraftActionController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(previewSupportDraftAction(req.body)));
  } catch (error) {
    return next(error);
  }
}

export async function createSupportDraftActionController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const result = await createSupportDraftProposedAction({ workspaceId: current.workspaceId, userId: current.userId, input: req.body });
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}
