import { Router } from 'express';
import {
  getAdsBudgetChangePayloadExample,
  getAdsBudgetChangePayloadSchema,
  getAdsBudgetChangePayloadStatus,
  previewAdsBudgetChangePayload,
} from './ads-budget-change-payload.controller.js';

export const adsBudgetChangePayloadRouter = Router();

// Phase 14.4: schema and preview validation only. No Meta/Google API client, OAuth route, token storage, write scope, executor, campaign pause, budget change, or external ad API call.
adsBudgetChangePayloadRouter.get('/budget-payload/status', getAdsBudgetChangePayloadStatus);
adsBudgetChangePayloadRouter.get('/budget-payload/schema', getAdsBudgetChangePayloadSchema);
adsBudgetChangePayloadRouter.get('/budget-payload/example', getAdsBudgetChangePayloadExample);
adsBudgetChangePayloadRouter.post('/budget-payload/preview', previewAdsBudgetChangePayload);
