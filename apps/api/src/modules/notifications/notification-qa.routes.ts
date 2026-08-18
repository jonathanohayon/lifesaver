import { Router } from 'express';
import { getNotificationQaReport, getNotificationQaStatus } from './notification-qa.controller.js';

export const notificationQaRouter = Router();

// Phase 10.10: read-only notification QA report. Routes are mounted behind authRequired in api-v1.ts.
notificationQaRouter.get('/qa/status', getNotificationQaStatus);
notificationQaRouter.get('/qa/report', getNotificationQaReport);
