import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportSendExecutorExample,
  buildSupportSendExecutorStatus,
  buildSupportSendPreview,
  executeManualApprovedGmailSupportReplySend,
  parseSupportSendExecutionBody,
} from './support-send-executor.model.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

export function getSupportSendExecutorStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportSendExecutorStatus()));
}

export function getSupportSendExecutorExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportSendExecutorExample()));
}

export function previewSupportSendExecutorController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildSupportSendPreview(req.body)));
  } catch (error) {
    return next(error);
  }
}

export async function executeSupportReplySendActionController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const body = parseSupportSendExecutionBody(req.body);
    const result = await executeManualApprovedGmailSupportReplySend({
      workspaceId: current.workspaceId,
      userId: current.userId,
      actionId: String(req.params.id || '').trim(),
      force: body.force,
    });
    return res.json(ok(result));
  } catch (error) {
    return next(error);
  }
}
