import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { previewApprovalRemindersForWorkspace } from './notification-approval-reminders.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

export async function getApprovalReminderPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const response = await previewApprovalRemindersForWorkspace({
      workspaceId: current.workspaceId,
      userId: current.userId,
      limit: req.query.limit,
    });
    return res.json(ok(response));
  } catch (error) {
    return next(error);
  }
}

export function getApprovalReminderStatus(_req: Request, res: Response) {
  return res.json(ok({
    version: '0.7.0',
    phase: 'phase_10_6_reminder_escalation_logic',
    status: 'available',
    reminders: {
      firstReminderUsesApprovalEscalationMinutes: true,
      repeatReminderUsesRepeatEscalationMinutes: true,
      respectsMaxEscalations: true,
      quietHoursMayDelayFutureEmail: true,
    },
    deliveryImplemented: {
      inAppRows: false,
      emailSending: false,
      slackSending: false,
      workerScheduler: false,
    },
    safety: {
      reminderSystemOnly: true,
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
