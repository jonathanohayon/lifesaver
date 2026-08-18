import { Router } from 'express';
import {
  getNotificationDeliveryLogsStatus,
  listNotificationDeliveryLogsController,
  recordNotificationOpenedController,
} from './notification-delivery-logs.controller.js';

export const notificationDeliveryLogsRouter = Router();

// Phase 10.8: delivery-log storage/audit only. No email sending, Slack sending, approval, execution, or external calls.
notificationDeliveryLogsRouter.get('/delivery-logs/status', getNotificationDeliveryLogsStatus);
notificationDeliveryLogsRouter.get('/delivery-logs', listNotificationDeliveryLogsController);
notificationDeliveryLogsRouter.post('/delivery-logs/opened', recordNotificationOpenedController);
