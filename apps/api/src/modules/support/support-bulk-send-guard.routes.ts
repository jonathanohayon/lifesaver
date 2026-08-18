import { Router } from 'express';
import {
  getSupportBulkSendGuardExample,
  getSupportBulkSendGuardStatus,
  previewSupportBulkSendGuardController,
} from './support-bulk-send-guard.controller.js';

export const supportBulkSendGuardRouter = Router();

// Phase 13.6: bulk-send guard preview only. No Gmail API call and no email sending.
supportBulkSendGuardRouter.get('/bulk-send-guard/status', getSupportBulkSendGuardStatus);
supportBulkSendGuardRouter.get('/bulk-send-guard/example', getSupportBulkSendGuardExample);
supportBulkSendGuardRouter.post('/bulk-send-guard/preview', previewSupportBulkSendGuardController);
