import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportPrivacySafeguardsExample,
  buildSupportPrivacySafeguardsPreview,
  buildSupportPrivacySafeguardsStatus,
} from './support-privacy-safeguards.model.js';

export function getSupportPrivacySafeguardsStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportPrivacySafeguardsStatus()));
}

export function getSupportPrivacySafeguardsExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportPrivacySafeguardsExample()));
}

export function previewSupportPrivacySafeguardsController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildSupportPrivacySafeguardsPreview(req.body)));
  } catch (error) {
    return next(error);
  }
}
