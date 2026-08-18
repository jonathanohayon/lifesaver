import { Router } from 'express';
import { getAdsConnectorAuditExample, getAdsConnectorAuditReport, getAdsConnectorAuditStatus } from './ads-connector-audit.controller.js';

export const adsConnectorAuditRouter = Router();

// Phase 14.1: audit/report only. No ad platform OAuth, token storage, API client, campaign pause, budget change, or external call.
adsConnectorAuditRouter.get('/connector-audit/status', getAdsConnectorAuditStatus);
adsConnectorAuditRouter.get('/connector-audit/report', getAdsConnectorAuditReport);
adsConnectorAuditRouter.get('/connector-audit/example', getAdsConnectorAuditExample);
