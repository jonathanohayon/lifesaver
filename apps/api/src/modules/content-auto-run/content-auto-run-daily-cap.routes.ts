import { Router } from 'express';
import { getContentAutoRunDailyCapPreview, getContentAutoRunDailyCapStatus } from './content-auto-run-daily-cap.controller.js';

export const contentAutoRunDailyCapRouter = Router();

// Phase 11.3: read-only daily post cap check. Mounted behind authRequired in api-v1.ts.
contentAutoRunDailyCapRouter.get('/daily-cap/status', getContentAutoRunDailyCapStatus);
contentAutoRunDailyCapRouter.get('/daily-cap/preview', getContentAutoRunDailyCapPreview);
