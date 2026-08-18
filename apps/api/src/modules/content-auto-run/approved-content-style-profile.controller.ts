import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildApprovedContentStyleStatus,
  buildDefaultApprovedContentStyleProfile,
  evaluateApprovedContentStyle,
} from './approved-content-style-profile.model.js';

export function getApprovedContentStyleStatus(_req: Request, res: Response) {
  return res.json(ok(buildApprovedContentStyleStatus()));
}

export function getApprovedContentStyleProfile(_req: Request, res: Response) {
  return res.json(ok(buildDefaultApprovedContentStyleProfile()));
}

export function getApprovedContentStylePreview(req: Request, res: Response, next: NextFunction) {
  try {
    const caption = typeof req.query.caption === 'string' ? req.query.caption : 'A calm founder update about improving ecommerce decisions with verified data and human approval.';
    const hashtags = typeof req.query.hashtags === 'string'
      ? req.query.hashtags.split(',').map((item) => item.trim()).filter(Boolean)
      : ['#ecommerce', '#founders'];
    const offerSourceAttached = req.query.offerSourceAttached === 'true';
    const complianceNoteAttached = req.query.complianceNoteAttached === 'true';
    return res.json(ok(evaluateApprovedContentStyle({ caption, hashtags, offerSourceAttached, complianceNoteAttached })));
  } catch (error) {
    return next(error);
  }
}
