import { Router } from 'express';
import { getAdsActionTypesExample, getAdsActionTypesStatus, getAdsActionTypesTaxonomy } from './ads-action-types.controller.js';

export const adsActionTypesRouter = Router();

// Phase 14.3: taxonomy only. No Meta/Google API client, OAuth route, token storage, write scope, executor, campaign pause, budget change, or external ad API call.
adsActionTypesRouter.get('/action-types/status', getAdsActionTypesStatus);
adsActionTypesRouter.get('/action-types/taxonomy', getAdsActionTypesTaxonomy);
adsActionTypesRouter.get('/action-types/example', getAdsActionTypesExample);
