import { Router } from 'express';
import {
  getAdsHardCapsExample,
  getAdsHardCapsSchema,
  getAdsHardCapsStatus,
  previewAdsHardCaps,
} from './ads-hard-caps.controller.js';

export const adsHardCapsRouter = Router();

// Phase 14.5: hard-cap storage/schema and preview evaluation only. No Meta/Google API client, OAuth route, token storage, write scope, executor, campaign pause, budget change, or external ad API call.
adsHardCapsRouter.get('/hard-caps/status', getAdsHardCapsStatus);
adsHardCapsRouter.get('/hard-caps/schema', getAdsHardCapsSchema);
adsHardCapsRouter.get('/hard-caps/example', getAdsHardCapsExample);
adsHardCapsRouter.post('/hard-caps/preview', previewAdsHardCaps);
