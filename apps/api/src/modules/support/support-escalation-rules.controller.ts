import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportEscalationRulesExample,
  buildSupportEscalationRulesPreview,
  buildSupportEscalationRulesStatus,
} from './support-escalation-rules.model.js';

export function getSupportEscalationRulesStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportEscalationRulesStatus()));
}

export function getSupportEscalationRulesExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportEscalationRulesExample()));
}

export function previewSupportEscalationRulesController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildSupportEscalationRulesPreview(req.body)));
  } catch (error) {
    return next(error);
  }
}
