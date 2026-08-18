import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildAdsActionTaxonomyReport, buildAdsActionTypesStatus } from './ads-action-types.model.js';

export function getAdsActionTypesStatus(_req: Request, res: Response) {
  return res.json(ok(buildAdsActionTypesStatus()));
}

export function getAdsActionTypesTaxonomy(_req: Request, res: Response) {
  return res.json(ok(buildAdsActionTaxonomyReport()));
}

export function getAdsActionTypesExample(_req: Request, res: Response) {
  const report = buildAdsActionTaxonomyReport();
  return res.json(ok({
    phase: report.phase,
    healthMode: report.healthMode,
    example: {
      actionTypeRegistry: report.actionTypeRegistry,
      categories: report.categories,
      sampleCriticalAction: report.actionTypes.find((item) => item.actionType === 'adjust_budget'),
      platformBoundary: report.platformBoundary,
      safety: report.safety,
    },
  }));
}
