import { Router } from 'express';
import {
  getAdsManualApprovalExecutorExample,
  getAdsManualApprovalExecutorReport,
  getAdsManualApprovalExecutorStatus,
  previewAdsManualApprovalExecutor,
} from './ads-manual-approval-executor.controller.js';

export const adsManualApprovalExecutorRouter = Router();

// Phase 14.6: approval-gated ads executor shell only. No Meta/Google API client, OAuth route, token storage, write scope request, campaign pause, budget change, restore, re-enable, auto-run, or external ad API call.
adsManualApprovalExecutorRouter.get('/manual-approval-executor/status', getAdsManualApprovalExecutorStatus);
adsManualApprovalExecutorRouter.get('/manual-approval-executor/report', getAdsManualApprovalExecutorReport);
adsManualApprovalExecutorRouter.get('/manual-approval-executor/example', getAdsManualApprovalExecutorExample);
adsManualApprovalExecutorRouter.post('/manual-approval-executor/preview', previewAdsManualApprovalExecutor);
