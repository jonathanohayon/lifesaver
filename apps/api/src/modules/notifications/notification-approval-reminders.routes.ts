import { Router } from 'express';
import { getApprovalReminderPreview, getApprovalReminderStatus } from './notification-approval-reminders.controller.js';

export const notificationApprovalRemindersRouter = Router();

// Phase 10.6: reminder/escalation preview only. No delivery, worker, approval, or execution.
notificationApprovalRemindersRouter.get('/reminders/status', getApprovalReminderStatus);
notificationApprovalRemindersRouter.get('/reminders/preview', getApprovalReminderPreview);
