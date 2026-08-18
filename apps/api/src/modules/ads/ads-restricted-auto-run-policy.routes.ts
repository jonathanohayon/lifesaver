import { Router } from 'express';
import {
  getAdsRestrictedAutoRunPolicyExample,
  getAdsRestrictedAutoRunPolicyReport,
  getAdsRestrictedAutoRunPolicyStatus,
  previewAdsRestrictedAutoRunPolicy,
} from './ads-restricted-auto-run-policy.controller.js';

export const adsRestrictedAutoRunPolicyRouter = Router();

// Phase 14.9: restricted ads auto-run policy preview only. No Meta/Google API client, OAuth route, token storage, write scope, executor, campaign pause, budget change, budget restore, re-enable, auto-run execution, or external ad API call.
adsRestrictedAutoRunPolicyRouter.get('/restricted-auto-run-policy/status', getAdsRestrictedAutoRunPolicyStatus);
adsRestrictedAutoRunPolicyRouter.get('/restricted-auto-run-policy/report', getAdsRestrictedAutoRunPolicyReport);
adsRestrictedAutoRunPolicyRouter.get('/restricted-auto-run-policy/example', getAdsRestrictedAutoRunPolicyExample);
adsRestrictedAutoRunPolicyRouter.post('/restricted-auto-run-policy/preview', previewAdsRestrictedAutoRunPolicy);
