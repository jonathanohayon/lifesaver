import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildAdsRollbackExecutorReport,
  buildAdsRollbackExecutorStatus,
  evaluateAdsRollbackExecutor,
} from './ads-rollback-executor.model.js';

export function getAdsRollbackExecutorStatus(_req: Request, res: Response) {
  return res.json(ok(buildAdsRollbackExecutorStatus()));
}

export function getAdsRollbackExecutorReport(_req: Request, res: Response) {
  return res.json(ok(buildAdsRollbackExecutorReport()));
}

export function getAdsRollbackExecutorExample(_req: Request, res: Response) {
  const report = buildAdsRollbackExecutorReport();
  return res.json(ok({
    phase: report.phase,
    healthMode: report.healthMode,
    supportedRollbackTypes: report.supportedRollbackTypes,
    exampleInput: report.exampleInput,
    exampleEvaluation: report.exampleEvaluation,
    safety: report.safety,
  }));
}

export function previewAdsRollbackExecutor(req: Request, res: Response) {
  return res.json(ok(evaluateAdsRollbackExecutor(req.body)));
}
