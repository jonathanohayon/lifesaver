import { Router } from 'express';
import {
  getAdsRollbackExecutorExample,
  getAdsRollbackExecutorReport,
  getAdsRollbackExecutorStatus,
  previewAdsRollbackExecutor,
} from './ads-rollback-executor.controller.js';

export const adsRollbackExecutorRouter = Router();

// Phase 14.8: rollback/re-enable executor shell only. No Meta/Google API client, OAuth route, token storage, write scope request, budget restore, campaign re-enable, adset re-enable, auto-run, or external ad API call.
adsRollbackExecutorRouter.get('/rollback-executor/status', getAdsRollbackExecutorStatus);
adsRollbackExecutorRouter.get('/rollback-executor/report', getAdsRollbackExecutorReport);
adsRollbackExecutorRouter.get('/rollback-executor/example', getAdsRollbackExecutorExample);
adsRollbackExecutorRouter.post('/rollback-executor/preview', previewAdsRollbackExecutor);
