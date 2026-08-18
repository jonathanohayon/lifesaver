import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildAdsManualApprovalExecutorReport,
  buildAdsManualApprovalExecutorStatus,
  evaluateAdsManualApprovalExecutorGate,
} from './ads-manual-approval-executor.model.js';

export function getAdsManualApprovalExecutorStatus(_req: Request, res: Response) {
  return res.json(ok(buildAdsManualApprovalExecutorStatus()));
}

export function getAdsManualApprovalExecutorReport(_req: Request, res: Response) {
  return res.json(ok(buildAdsManualApprovalExecutorReport()));
}

export function getAdsManualApprovalExecutorExample(_req: Request, res: Response) {
  const report = buildAdsManualApprovalExecutorReport();
  return res.json(ok({
    phase: report.phase,
    healthMode: report.healthMode,
    executorName: report.executorName,
    exampleInput: report.exampleInput,
    exampleEvaluation: report.exampleEvaluation,
    safety: report.safety,
  }));
}

export function previewAdsManualApprovalExecutor(req: Request, res: Response) {
  return res.json(ok(evaluateAdsManualApprovalExecutorGate(req.body)));
}
