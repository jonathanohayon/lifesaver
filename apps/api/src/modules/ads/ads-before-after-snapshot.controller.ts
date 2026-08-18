import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildAdsBeforeAfterSnapshotReport,
  buildAdsBeforeAfterSnapshotStatus,
  evaluateAdsBeforeAfterSnapshot,
} from './ads-before-after-snapshot.model.js';

export function getAdsBeforeAfterSnapshotStatus(_req: Request, res: Response) {
  return res.json(ok(buildAdsBeforeAfterSnapshotStatus()));
}

export function getAdsBeforeAfterSnapshotReport(_req: Request, res: Response) {
  return res.json(ok(buildAdsBeforeAfterSnapshotReport()));
}

export function getAdsBeforeAfterSnapshotExample(_req: Request, res: Response) {
  const report = buildAdsBeforeAfterSnapshotReport();
  return res.json(ok({
    phase: report.phase,
    healthMode: report.healthMode,
    storageTable: report.storageTable,
    migrationFile: report.migrationFile,
    requiredBeforeExecutionFields: report.requiredBeforeExecutionFields,
    exampleInput: report.exampleInput,
    exampleEvaluation: report.exampleEvaluation,
    safety: report.safety,
  }));
}

export function previewAdsBeforeAfterSnapshot(req: Request, res: Response) {
  return res.json(ok(evaluateAdsBeforeAfterSnapshot(req.body)));
}
