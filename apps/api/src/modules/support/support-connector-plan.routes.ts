import { Router } from 'express';
import { getSupportConnectorPlan, getSupportConnectorPlanStatus } from './support-connector-plan.controller.js';

export const supportConnectorPlanRouter = Router();

// Phase 12.1: selected support connector plan only. No Gmail API client, OAuth route, token storage, read, send, or external call.
supportConnectorPlanRouter.get('/connector-plan/status', getSupportConnectorPlanStatus);
supportConnectorPlanRouter.get('/connector-plan/plan', getSupportConnectorPlan);
