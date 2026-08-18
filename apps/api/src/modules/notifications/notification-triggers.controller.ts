import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { evaluateNotificationTriggersForWorkspace } from './notification-triggers.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

export async function getNotificationTriggerPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const response = await evaluateNotificationTriggersForWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
      limit: req.query.limit,
    });
    return res.json(ok(response));
  } catch (error) {
    return next(error);
  }
}

export function getNotificationTriggerStatus(_req: Request, res: Response) {
  return res.json(ok({
    version: '0.7.0',
    phase: 'phase_10_5_notification_event_triggers',
    status: 'available',
    triggers: [
      'action_proposed',
      'action_failed',
      'high_risk_action_waiting',
      'approval_reminder_needed',
    ],
    deliveryImplemented: {
      inAppRows: false,
      emailSending: false,
      slackSending: false,
    },
    safety: {
      triggerServiceOnly: true,
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
