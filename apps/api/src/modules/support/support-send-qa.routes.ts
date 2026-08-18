import { Router } from 'express';
import {
  getSupportSendQaExample,
  getSupportSendQaReport,
  getSupportSendQaStatus,
  previewSupportSendQaReportController,
} from './support-send-qa.controller.js';

export const supportSendQaRouter = Router();

// Phase 13.10: Support send QA report. Uses a mocked Gmail client by default; no live email sending.
supportSendQaRouter.get('/send-qa/status', getSupportSendQaStatus);
supportSendQaRouter.get('/send-qa/example', getSupportSendQaExample);
supportSendQaRouter.get('/send-qa/report', getSupportSendQaReport);
supportSendQaRouter.post('/send-qa/preview', previewSupportSendQaReportController);
