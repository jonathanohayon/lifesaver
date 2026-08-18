import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { listNotificationDeliveryLogs, recordNotificationOpened } from './notification-delivery-logs.service.js';

function auth(req: Request) {
  return (req as any).auth as { userId: string; workspaceId: string; workspaceRole?: string };
}

export function getNotificationDeliveryLogsStatus(_req: Request, res: Response) {
  return res.json(ok({
    version: '0.7.0',
    phase: 'phase_10_8_delivery_logs',
    status: 'available',
    logs: {
      notificationCreated: true,
      notificationSent: true,
      notificationFailed: true,
      notificationOpened: true,
    },
    endpoints: {
      listLogs: 'GET /api/v1/notifications/delivery-logs',
      openedLog: 'POST /api/v1/notifications/delivery-logs/opened',
    },
    deliveryImplemented: {
      emailSending: false,
      slackSending: false,
      inAppDeliveryRows: false,
      workerScheduler: false,
    },
    safety: {
      deliveryLogsOnly: true,
      sendsEmailInThisPhase: false,
      sendsSlackInThisPhase: false,
      callsExternalServices: false,
      canApproveAction: false,
      canExecuteAction: false,
      exposesTokensOrSecrets: false,
      exposesActionPayloadJson: false,
      exposesRollbackPayload: false,
    },
  }));
}

export async function listNotificationDeliveryLogsController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const response = await listNotificationDeliveryLogs({
      workspaceId: current.workspaceId,
      userId: current.userId,
      limit: req.query.limit,
      eventType: req.query.eventType,
      channel: req.query.channel,
    });
    return res.json(ok(response));
  } catch (error) {
    return next(error);
  }
}

export async function recordNotificationOpenedController(req: Request, res: Response, next: NextFunction) {
  try {
    const current = auth(req);
    const response = await recordNotificationOpened({
      workspaceId: current.workspaceId,
      userId: current.userId,
      actionId: req.body?.actionId,
      notificationKey: req.body?.notificationKey,
      channel: req.body?.channel,
    });
    return res.status(201).json(ok(response));
  } catch (error) {
    return next(error);
  }
}
