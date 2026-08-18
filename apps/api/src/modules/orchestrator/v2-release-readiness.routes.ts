import { Router } from 'express';
import {
  getV2ReleaseReadinessChecklistController,
  getV2ReleaseReadinessExampleController,
  getV2ReleaseReadinessReportController,
  getV2ReleaseReadinessStatusController,
  previewV2ReleaseReadinessController,
} from './v2-release-readiness.controller.js';

export const v2ReleaseReadinessRouter = Router();

v2ReleaseReadinessRouter.get('/v2-release-readiness/status', getV2ReleaseReadinessStatusController);
v2ReleaseReadinessRouter.get('/v2-release-readiness/report', getV2ReleaseReadinessReportController);
v2ReleaseReadinessRouter.get('/v2-release-readiness/checklist', getV2ReleaseReadinessChecklistController);
v2ReleaseReadinessRouter.get('/v2-release-readiness/example', getV2ReleaseReadinessExampleController);
v2ReleaseReadinessRouter.post('/v2-release-readiness/preview', previewV2ReleaseReadinessController);
