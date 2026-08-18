import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportSyncStatusCurrent,
  buildSupportSyncStatusExample,
  buildSupportSyncStatusPreview,
  buildSupportSyncStatusStatus,
} from './support-sync-status.model.js';

export function getSupportSyncStatusStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportSyncStatusStatus()));
}

export function getSupportSyncStatusCurrent(_req: Request, res: Response) {
  return res.json(ok(buildSupportSyncStatusCurrent()));
}

export function getSupportSyncStatusExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportSyncStatusExample()));
}

export function previewSupportSyncStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildSupportSyncStatusPreview(req.body)));
  } catch (error) {
    return next(error);
  }
}
