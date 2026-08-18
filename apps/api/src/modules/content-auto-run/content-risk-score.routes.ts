import { Router } from 'express';
import { getContentRiskScorePreview, getContentRiskScoreStatus } from './content-risk-score.controller.js';

export const contentRiskScoreRouter = Router();

// Phase 11.2: read-only content risk scoring. Mounted behind authRequired in api-v1.ts.
contentRiskScoreRouter.get('/risk-score/status', getContentRiskScoreStatus);
contentRiskScoreRouter.get('/risk-score/preview', getContentRiskScorePreview);
