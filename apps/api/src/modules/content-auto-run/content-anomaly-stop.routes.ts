import { Router } from 'express';
import { getContentAnomalyStopPreview, getContentAnomalyStopStatus } from './content-anomaly-stop.controller.js';

export const contentAnomalyStopRouter = Router();

// Phase 11.8: read-only anomaly stop preview for the future narrow content auto-run lane.
contentAnomalyStopRouter.get('/anomaly-stop/status', getContentAnomalyStopStatus);
contentAnomalyStopRouter.get('/anomaly-stop/preview', getContentAnomalyStopPreview);
