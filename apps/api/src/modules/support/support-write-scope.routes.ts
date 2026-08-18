import { Router } from 'express';
import { getSupportWriteScopeChecklist, getSupportWriteScopeStatus, previewSupportWriteScopeGates } from './support-write-scope.controller.js';

export const supportWriteScopeRouter = Router();

// Phase 13.1: support write-scope setup checklist only. No Gmail OAuth route, send scope request, API client, or email sending.
supportWriteScopeRouter.get('/write-scope/status', getSupportWriteScopeStatus);
supportWriteScopeRouter.get('/write-scope/checklist', getSupportWriteScopeChecklist);
supportWriteScopeRouter.post('/write-scope/preview', previewSupportWriteScopeGates);
