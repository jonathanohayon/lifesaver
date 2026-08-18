import { Router } from 'express';
import {
  getAdsSafetyQaExample,
  getAdsSafetyQaReport,
  getAdsSafetyQaStatus,
  previewAdsSafetyQa,
} from './ads-safety-qa.controller.js';

export const adsSafetyQaRouter = Router();

// Phase 14.10: Ads safety QA and risk sign-off report only. No Meta/Google Ads API client, OAuth route, token storage, write scope, budget mutation, campaign/adset pause, rollback mutation, auto-run, or external ad API call.
adsSafetyQaRouter.get('/safety-qa/status', getAdsSafetyQaStatus);
adsSafetyQaRouter.get('/safety-qa/report', getAdsSafetyQaReport);
adsSafetyQaRouter.get('/safety-qa/example', getAdsSafetyQaExample);
adsSafetyQaRouter.post('/safety-qa/preview', previewAdsSafetyQa);
