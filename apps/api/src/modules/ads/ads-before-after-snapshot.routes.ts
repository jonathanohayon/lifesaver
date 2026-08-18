import { Router } from 'express';
import {
  getAdsBeforeAfterSnapshotExample,
  getAdsBeforeAfterSnapshotReport,
  getAdsBeforeAfterSnapshotStatus,
  previewAdsBeforeAfterSnapshot,
} from './ads-before-after-snapshot.controller.js';

export const adsBeforeAfterSnapshotRouter = Router();

// Phase 14.7: before/after audit snapshot contract only. No Meta/Google API client, OAuth route, token storage, write scope request, campaign pause, ad set pause, budget change, restore, re-enable, auto-run, or external ad API call.
adsBeforeAfterSnapshotRouter.get('/before-after-snapshot/status', getAdsBeforeAfterSnapshotStatus);
adsBeforeAfterSnapshotRouter.get('/before-after-snapshot/report', getAdsBeforeAfterSnapshotReport);
adsBeforeAfterSnapshotRouter.get('/before-after-snapshot/example', getAdsBeforeAfterSnapshotExample);
adsBeforeAfterSnapshotRouter.post('/before-after-snapshot/preview', previewAdsBeforeAfterSnapshot);
