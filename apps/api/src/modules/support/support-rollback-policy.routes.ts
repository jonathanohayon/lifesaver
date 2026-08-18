import { Router } from 'express';
import {
  getSupportRollbackPolicyExample,
  getSupportRollbackPolicyStatus,
  previewSupportRollbackPolicyController,
} from './support-rollback-policy.controller.js';

export const supportRollbackPolicyRouter = Router();

// Phase 13.9: support rollback policy preview only. Gmail emails cannot truly be undone here.
supportRollbackPolicyRouter.get('/rollback-policy/status', getSupportRollbackPolicyStatus);
supportRollbackPolicyRouter.get('/rollback-policy/example', getSupportRollbackPolicyExample);
supportRollbackPolicyRouter.post('/rollback-policy/preview', previewSupportRollbackPolicyController);
