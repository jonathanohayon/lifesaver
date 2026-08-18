import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildSecureApprovalLinksStatus, buildSecureApprovalReviewUrl } from './notification-secure-approval-links.model.js';
import type { SecureApprovalLinkSource } from './notification-secure-approval-links.types.js';

export function getSecureApprovalLinksStatus(_req: Request, res: Response) {
  return res.json(ok(buildSecureApprovalLinksStatus()));
}

export function getSecureApprovalLinksPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const actionId = String(req.query.actionId || req.query.action_id || '').trim();
    const appBaseUrl = typeof req.query.appBaseUrl === 'string' ? req.query.appBaseUrl : null;
    const source = typeof req.query.source === 'string' ? req.query.source as SecureApprovalLinkSource : 'manual_copy';
    const notificationKey = typeof req.query.notificationKey === 'string'
      ? req.query.notificationKey
      : (typeof req.query.notification_key === 'string' ? req.query.notification_key : null);
    return res.json(ok(buildSecureApprovalReviewUrl({ actionId, appBaseUrl, source, notificationKey })));
  } catch (error) {
    return next(error);
  }
}
