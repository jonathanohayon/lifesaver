import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportFaqAutoReplyPolicyExample,
  buildSupportFaqAutoReplyPolicyStatus,
  previewSupportFaqAutoReplyPolicy,
} from './support-faq-auto-reply-policy.model.js';

export function getSupportFaqAutoReplyPolicyStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportFaqAutoReplyPolicyStatus()));
}

export function getSupportFaqAutoReplyPolicyExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportFaqAutoReplyPolicyExample()));
}

export function previewSupportFaqAutoReplyPolicyController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(previewSupportFaqAutoReplyPolicy(req.body || {})));
  } catch (error) {
    return next(error);
  }
}
