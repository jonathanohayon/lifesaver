import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildAdsWriteScopeReport, buildAdsWriteScopeStatus } from './ads-write-scope-planning.model.js';

export function getAdsWriteScopeStatus(_req: Request, res: Response) {
  return res.json(ok(buildAdsWriteScopeStatus()));
}

export function getAdsWriteScopeChecklist(_req: Request, res: Response) {
  return res.json(ok(buildAdsWriteScopeReport()));
}

export function getAdsWriteScopeExample(_req: Request, res: Response) {
  const report = buildAdsWriteScopeReport();
  return res.json(ok({
    phase: report.phase,
    healthMode: report.healthMode,
    example: {
      platforms: report.platforms.map((platform) => ({
        platform: platform.platform,
        label: platform.label,
        futureControls: platform.futureControls.slice(0, 3),
        notAddedInThisPhase: platform.notAddedInThisPhase,
      })),
      checklistCategories: Array.from(new Set(report.checklist.map((item) => item.category))),
      tokenStoragePolicy: report.tokenStoragePolicy,
      safety: report.safety,
    },
  }));
}
