import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { buildSecureApprovalDeepLink } from './notification-deep-links.model.js';

export function getApprovalDeepLinkStatus(_req: Request, res: Response) {
  return res.json(ok({
    version: '0.7.0',
    phase: 'phase_10_4_approval_deep_links',
    status: 'available',
    targetPage: '/actions.html',
    targetMode: 'action_detail_drawer',
    supportedQueryParams: ['actionId', 'source'],
    requiresLogin: true,
    safety: {
      readOnlyStatus: true,
      canApproveByLinkAlone: false,
      canExecuteByLinkAlone: false,
      exposesTokensOrSecrets: false,
      exposesActionPayloadJson: false,
      externalServicesCalled: false,
    },
  }));
}

export function getApprovalDeepLinkPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const actionId = String(req.query.actionId || req.query.action_id || '').trim();
    const appBaseUrl = typeof req.query.appBaseUrl === 'string' ? req.query.appBaseUrl : null;
    const source = typeof req.query.source === 'string' ? req.query.source as any : 'manual_copy';
    return res.json(ok(buildSecureApprovalDeepLink({ actionId, appBaseUrl, source })));
  } catch (error) {
    return next(error);
  }
}
