import { Router } from 'express';
import {
  getSupportSyncStatusCurrent,
  getSupportSyncStatusExample,
  getSupportSyncStatusStatus,
  previewSupportSyncStatusController,
} from './support-sync-status.controller.js';

export const supportSyncStatusRouter = Router();

// Phase 12.8: support connector status UI data only. No Gmail API client, no token value return, no sending.
supportSyncStatusRouter.get('/sync-status/status', getSupportSyncStatusStatus);
supportSyncStatusRouter.get('/sync-status/current', getSupportSyncStatusCurrent);
supportSyncStatusRouter.get('/sync-status/example', getSupportSyncStatusExample);
supportSyncStatusRouter.post('/sync-status/preview', previewSupportSyncStatusController);
