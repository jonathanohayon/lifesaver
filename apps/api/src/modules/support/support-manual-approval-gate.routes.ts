import { Router } from 'express';
import {
  getSupportManualApprovalGateExample,
  getSupportManualApprovalGateStatus,
  previewSupportManualApprovalGateController,
} from './support-manual-approval-gate.controller.js';

export const supportManualApprovalGateRouter = Router();

// Phase 13.3: central support-send approval gate. No Gmail API call and no email sending.
supportManualApprovalGateRouter.get('/manual-approval-gate/status', getSupportManualApprovalGateStatus);
supportManualApprovalGateRouter.get('/manual-approval-gate/example', getSupportManualApprovalGateExample);
supportManualApprovalGateRouter.post('/manual-approval-gate/preview', previewSupportManualApprovalGateController);
