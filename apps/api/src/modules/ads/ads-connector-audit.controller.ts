import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildAdsConnectorAuditReport, buildAdsConnectorAuditStatus } from './ads-connector-audit.model.js';

export function getAdsConnectorAuditStatus(_req: Request, res: Response) {
  return res.json(ok(buildAdsConnectorAuditStatus()));
}

export function getAdsConnectorAuditReport(_req: Request, res: Response) {
  return res.json(ok(buildAdsConnectorAuditReport()));
}

export function getAdsConnectorAuditExample(_req: Request, res: Response) {
  const report = buildAdsConnectorAuditReport();
  return res.json(ok({
    phase: report.phase,
    healthMode: report.healthMode,
    example: {
      readSource: report.boundaries.find((boundary) => boundary.source === 'triple_whale'),
      futureControlSource: report.boundaries.find((boundary) => boundary.source === 'direct_platform_api'),
      firstRequiredControlPlatforms: report.recommendedControlOrder.slice(0, 2),
      safety: report.safety,
    },
  }));
}
