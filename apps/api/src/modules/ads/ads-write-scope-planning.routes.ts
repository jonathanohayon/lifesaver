import { Router } from 'express';
import { getAdsWriteScopeChecklist, getAdsWriteScopeExample, getAdsWriteScopeStatus } from './ads-write-scope-planning.controller.js';

export const adsWriteScopeRouter = Router();

// Phase 14.2: checklist/planning only. No Meta/Google OAuth, token storage, API client, write scope request, campaign pause, budget change, or external call.
adsWriteScopeRouter.get('/write-scope/status', getAdsWriteScopeStatus);
adsWriteScopeRouter.get('/write-scope/checklist', getAdsWriteScopeChecklist);
adsWriteScopeRouter.get('/write-scope/example', getAdsWriteScopeExample);
