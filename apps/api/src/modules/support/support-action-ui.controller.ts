import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportActionUiExample,
  buildSupportActionUiPreview,
  buildSupportActionUiStatus,
} from './support-action-ui.model.js';

export function getSupportActionUiStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportActionUiStatus()));
}

export function getSupportActionUiExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportActionUiExample()));
}

export function previewSupportActionUi(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildSupportActionUiPreview(req.body)));
  } catch (error) {
    return next(error);
  }
}
