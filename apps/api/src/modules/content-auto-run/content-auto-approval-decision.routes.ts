import { Router } from 'express';
import { getContentAutoApprovalDecisionPreview, getContentAutoApprovalDecisionStatus } from './content-auto-approval-decision.controller.js';

export const contentAutoApprovalDecisionRouter = Router();

// Phase 11.5: read-only auto-approval decision record preview. Mounted behind authRequired in api-v1.ts.
contentAutoApprovalDecisionRouter.get('/auto-approval/status', getContentAutoApprovalDecisionStatus);
contentAutoApprovalDecisionRouter.get('/auto-approval/preview', getContentAutoApprovalDecisionPreview);
