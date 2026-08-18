import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportSendResultLogsExample,
  buildSupportSendResultLogsStatus,
  previewSupportSendResultLog,
} from './support-send-result-logs.model.js';

export function getSupportSendResultLogsStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportSendResultLogsStatus()));
}

export function getSupportSendResultLogsExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportSendResultLogsExample()));
}

export function previewSupportSendResultLogController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(previewSupportSendResultLog(req.body || {})));
  } catch (error) {
    return next(error);
  }
}
