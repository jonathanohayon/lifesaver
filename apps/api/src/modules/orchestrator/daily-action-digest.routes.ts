import { Router } from 'express';
import {
  getDailyActionDigestExample,
  getDailyActionDigestReport,
  getDailyActionDigestStatus,
  previewDailyActionDigestController,
} from './daily-action-digest.controller.js';

export const dailyActionDigestRouter = Router();

// Phase 15.8: V2 Daily Brief action digest builder only. No scheduler enablement, no action creation, no executor call, no auto-run, and no external connector call.
dailyActionDigestRouter.get('/daily-action-digest/status', getDailyActionDigestStatus);
dailyActionDigestRouter.get('/daily-action-digest/report', getDailyActionDigestReport);
dailyActionDigestRouter.get('/daily-action-digest/example', getDailyActionDigestExample);
dailyActionDigestRouter.post('/daily-action-digest/preview', previewDailyActionDigestController);
