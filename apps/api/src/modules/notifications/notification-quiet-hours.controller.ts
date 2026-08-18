import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { previewQuietHoursEnforcementForWorkspace } from './notification-quiet-hours.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

export async function getQuietHoursPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const response = await previewQuietHoursEnforcementForWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
      limit: req.query.limit,
    });
    return res.json(ok(response));
  } catch (error) {
    return next(error);
  }
}

export function getQuietHoursStatus(_req: Request, res: Response) {
  return res.json(ok({
    version: '0.7.0',
    phase: 'phase_10_7_quiet_hours_enforcement',
    status: 'available',
    enforcement: {
      delaysNonCriticalDuringQuietHours: true,
      criticalOverrideAllowed: true,
      channelsCovered: ['in_app', 'email'],
      slackPlannedLater: true,
      exactDeliveryImplemented: false,
    },
    deliveryImplemented: {
      inAppRows: false,
      emailSending: false,
      slackSending: false,
      workerScheduler: false,
    },
    safety: {
      quietHoursEnforcementOnly: true,
      createsNotificationRowsInThisPhase: false,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      callsExternalServices: false,
      canApproveAction: false,
      canExecuteAction: false,
      exposesTokensOrSecrets: false,
      exposesActionPayloadJson: false,
    },
  }));
}
