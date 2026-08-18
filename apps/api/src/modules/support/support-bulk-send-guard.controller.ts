import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportBulkSendGuardExample,
  buildSupportBulkSendGuardStatus,
  previewSupportBulkSendGuard,
} from './support-bulk-send-guard.model.js';

export function getSupportBulkSendGuardStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportBulkSendGuardStatus()));
}

export function getSupportBulkSendGuardExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportBulkSendGuardExample()));
}

export function previewSupportBulkSendGuardController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(previewSupportBulkSendGuard(req.body || {})));
  } catch (error) {
    return next(error);
  }
}
