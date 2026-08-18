import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ok } from '../../common/utils/api-response.js';
import { AppError } from '../../common/errors/AppError.js';
import { createContentDraft, createSupportReplyDraft, getDrafts, setDraftStatus } from './drafts.service.js';

const statusSchema = z.object({ status: z.enum(['draft', 'approved', 'rejected']) });

export async function listDraftsController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    return res.json(ok(await getDrafts(auth.workspaceId)));
  } catch (error) { return next(error); }
}

export async function createContentDraftController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    return res.json(ok(await createContentDraft(auth.workspaceId, auth.userId, req.body)));
  } catch (error) { return next(error); }
}

export async function createSupportReplyDraftController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    return res.json(ok(await createSupportReplyDraft(auth.workspaceId, auth.userId, req.body)));
  } catch (error) { return next(error); }
}

export async function updateDraftStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const draftId = String(req.params.id || '');
    if (!draftId) throw new AppError(400, 'DRAFT_ID_REQUIRED', 'Draft ID is required.');
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Status must be draft, approved, or rejected.');
    return res.json(ok(await setDraftStatus(auth.workspaceId, draftId, parsed.data.status)));
  } catch (error) { return next(error); }
}
