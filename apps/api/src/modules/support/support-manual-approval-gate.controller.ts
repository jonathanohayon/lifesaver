import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportManualApprovalGateExample,
  buildSupportManualApprovalGateStatus,
  previewSupportManualApprovalGate,
} from './support-manual-approval-gate.model.js';

export function getSupportManualApprovalGateStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportManualApprovalGateStatus()));
}

export function getSupportManualApprovalGateExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportManualApprovalGateExample()));
}

export function previewSupportManualApprovalGateController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(previewSupportManualApprovalGate(req.body || {})));
  } catch (error) {
    return next(error);
  }
}
