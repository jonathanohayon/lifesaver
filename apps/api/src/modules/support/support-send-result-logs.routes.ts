import { Router } from 'express';
import {
  getSupportSendResultLogsExample,
  getSupportSendResultLogsStatus,
  previewSupportSendResultLogController,
} from './support-send-result-logs.controller.js';

export const supportSendResultLogsRouter = Router();

// Phase 13.8: support send result log preview only. No Gmail API call and no email sending.
supportSendResultLogsRouter.get('/send-result-logs/status', getSupportSendResultLogsStatus);
supportSendResultLogsRouter.get('/send-result-logs/example', getSupportSendResultLogsExample);
supportSendResultLogsRouter.post('/send-result-logs/preview', previewSupportSendResultLogController);
