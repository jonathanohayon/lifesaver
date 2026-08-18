import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildAdsHardCapsStorageReport,
  buildAdsHardCapsStatus,
  evaluateAdsHardCaps,
} from './ads-hard-caps.model.js';

export function getAdsHardCapsStatus(_req: Request, res: Response) {
  return res.json(ok(buildAdsHardCapsStatus()));
}

export function getAdsHardCapsSchema(_req: Request, res: Response) {
  return res.json(ok(buildAdsHardCapsStorageReport()));
}

export function getAdsHardCapsExample(_req: Request, res: Response) {
  const report = buildAdsHardCapsStorageReport();
  return res.json(ok({
    phase: report.phase,
    healthMode: report.healthMode,
    exampleCaps: report.exampleCaps,
    exampleBudgetPayload: report.exampleBudgetPayload,
    exampleEvaluation: report.exampleEvaluation,
    migration: report.migration,
    safety: report.safety,
  }));
}

export function previewAdsHardCaps(req: Request, res: Response) {
  return res.json(ok(evaluateAdsHardCaps(req.body)));
}
