import { Router } from 'express';
import {
  getCostAnomalyExample,
  getCostAnomalyReport,
  getCostAnomalyStatus,
  previewCostAnomalyController,
} from './cost-anomaly-hardening.controller.js';

export const costAnomalyHardeningRouter = Router();

// Phase 15.9: Cost caps + anomaly alerts hardening only. No scheduler, notification send, action creation, executor call, auto-run, Claude call, or external connector call.
costAnomalyHardeningRouter.get('/cost-anomaly-hardening/status', getCostAnomalyStatus);
costAnomalyHardeningRouter.get('/cost-anomaly-hardening/report', getCostAnomalyReport);
costAnomalyHardeningRouter.get('/cost-anomaly-hardening/example', getCostAnomalyExample);
costAnomalyHardeningRouter.post('/cost-anomaly-hardening/preview', previewCostAnomalyController);
