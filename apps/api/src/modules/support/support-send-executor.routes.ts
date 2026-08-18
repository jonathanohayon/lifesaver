import { Router } from 'express';
import {
  getSupportSendExecutorExample,
  getSupportSendExecutorStatus,
  previewSupportSendExecutorController,
} from './support-send-executor.controller.js';

export const supportSendExecutorRouter = Router();

// Phase 13.2: status and preview for the manual-approved Gmail support send executor.
// Status/example/preview never send email and never return raw OAuth tokens or raw MIME.
supportSendExecutorRouter.get('/send-executor/status', getSupportSendExecutorStatus);
supportSendExecutorRouter.get('/send-executor/example', getSupportSendExecutorExample);
supportSendExecutorRouter.post('/send-executor/preview', previewSupportSendExecutorController);
