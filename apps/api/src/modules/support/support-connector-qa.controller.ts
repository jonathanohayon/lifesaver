import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportConnectorQaReport,
  buildSupportConnectorQaStatus,
} from './support-connector-qa.model.js';

export function getSupportConnectorQaStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportConnectorQaStatus()));
}

export function getSupportConnectorQaReport(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildSupportConnectorQaReport()));
  } catch (error) {
    return next(error);
  }
}

export function previewSupportConnectorQaReport(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildSupportConnectorQaReport(req.body)));
  } catch (error) {
    return next(error);
  }
}
