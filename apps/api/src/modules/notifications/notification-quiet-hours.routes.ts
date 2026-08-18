import { Router } from 'express';
import { getQuietHoursPreview, getQuietHoursStatus } from './notification-quiet-hours.controller.js';

export const notificationQuietHoursRouter = Router();

// Phase 10.7: read-only quiet-hours enforcement preview/status only. No delivery, worker, approval, execution, or external calls.
notificationQuietHoursRouter.get('/quiet-hours/status', getQuietHoursStatus);
notificationQuietHoursRouter.get('/quiet-hours/preview', getQuietHoursPreview);
