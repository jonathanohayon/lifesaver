import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportRollbackPolicyExample,
  buildSupportRollbackPolicyStatus,
  previewSupportRollbackPolicy,
} from './support-rollback-policy.model.js';

export function getSupportRollbackPolicyStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportRollbackPolicyStatus()));
}

export function getSupportRollbackPolicyExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportRollbackPolicyExample()));
}

export function previewSupportRollbackPolicyController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(previewSupportRollbackPolicy(req.body || {})));
  } catch (error) {
    return next(error);
  }
}
