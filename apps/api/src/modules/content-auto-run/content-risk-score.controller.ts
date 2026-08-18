import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildContentRiskScoreStatus, calculateContentRiskScore } from './content-risk-score.model.js';

function parseBoolean(value: unknown): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export function getContentRiskScoreStatus(_req: Request, res: Response) {
  return res.json(ok(buildContentRiskScoreStatus()));
}

export function getContentRiskScorePreview(req: Request, res: Response, next: NextFunction) {
  try {
    const caption = typeof req.query.caption === 'string'
      ? req.query.caption
      : 'A calm founder update about safer ecommerce automation, verified metrics, and approval-first content operations.';
    const hashtags = typeof req.query.hashtags === 'string'
      ? req.query.hashtags.split(',').map((item) => item.trim()).filter(Boolean)
      : ['#ecommerce', '#founders'];

    return res.json(ok(calculateContentRiskScore({
      caption,
      hashtags,
      platform: typeof req.query.platform === 'string' ? req.query.platform : 'linkedin',
      mediaType: typeof req.query.mediaType === 'string' ? req.query.mediaType : 'none',
      offerSourceAttached: parseBoolean(req.query.offerSourceAttached),
      verifiedMetricSourceAttached: parseBoolean(req.query.verifiedMetricSourceAttached),
      complianceNoteAttached: parseBoolean(req.query.complianceNoteAttached),
      approvedBrandStyleMatched: parseBoolean(req.query.approvedBrandStyleMatched),
    })));
  } catch (error) {
    return next(error);
  }
}
