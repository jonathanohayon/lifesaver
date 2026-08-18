import { Router } from 'express';
import {
  getFunctionalAuditChecklistController,
  getFunctionalAuditExampleController,
  getFunctionalAuditMapController,
  getFunctionalAuditReportController,
  getFunctionalAuditStatusController,
  previewFunctionalAuditController,
} from './functional-audit.controller.js';

export const functionalAuditRouter = Router();

// v0.8.0: Functional audit only. No database migration, action creation, executor call, auto-run, Claude call, or external connector call.
functionalAuditRouter.get('/functional-audit/status', getFunctionalAuditStatusController);
functionalAuditRouter.get('/functional-audit/report', getFunctionalAuditReportController);
functionalAuditRouter.get('/functional-audit/map', getFunctionalAuditMapController);
functionalAuditRouter.get('/functional-audit/checklist', getFunctionalAuditChecklistController);
functionalAuditRouter.get('/functional-audit/example', getFunctionalAuditExampleController);
functionalAuditRouter.post('/functional-audit/preview', previewFunctionalAuditController);
