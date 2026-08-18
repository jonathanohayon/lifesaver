import { Router } from 'express';
import { getNotificationTriggerPreview, getNotificationTriggerStatus } from './notification-triggers.controller.js';

export const notificationTriggersRouter = Router();

// Phase 10.5: read-only trigger preview/status only. No notification delivery, approval, execution, or external calls.
notificationTriggersRouter.get('/triggers/status', getNotificationTriggerStatus);
notificationTriggersRouter.get('/triggers/preview', getNotificationTriggerPreview);
