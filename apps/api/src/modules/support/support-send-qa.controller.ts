import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportSendQaExample,
  buildSupportSendQaReport,
  buildSupportSendQaStatus,
  previewSupportSendQaReport,
} from './support-send-qa.model.js';

export function getSupportSendQaStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportSendQaStatus()));
}

export async function getSupportSendQaExample(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(await buildSupportSendQaExample()));
  } catch (error) {
    return next(error);
  }
}

export async function getSupportSendQaReport(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(await buildSupportSendQaReport()));
  } catch (error) {
    return next(error);
  }
}

export async function previewSupportSendQaReportController(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(await previewSupportSendQaReport()));
  } catch (error) {
    return next(error);
  }
}
