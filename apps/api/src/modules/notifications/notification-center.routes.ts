import { Router } from 'express';
import { getNotificationCenterController } from './notification-center.controller.js';

export const notificationCenterRouter = Router();

// Phase 10.2: read-only in-app notification center.
// It shows pending approvals and recent action events only; it cannot approve, execute, publish, send email, or call Slack.
notificationCenterRouter.get('/center', getNotificationCenterController);
