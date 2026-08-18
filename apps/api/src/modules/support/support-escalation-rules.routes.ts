import { Router } from 'express';
import {
  getSupportEscalationRulesExample,
  getSupportEscalationRulesStatus,
  previewSupportEscalationRulesController,
} from './support-escalation-rules.controller.js';

export const supportEscalationRulesRouter = Router();

// Phase 12.7: support escalation logic only. No Gmail API client, no sending, no auto-reply, no action execution.
supportEscalationRulesRouter.get('/escalation-rules/status', getSupportEscalationRulesStatus);
supportEscalationRulesRouter.get('/escalation-rules/example', getSupportEscalationRulesExample);
supportEscalationRulesRouter.post('/escalation-rules/preview', previewSupportEscalationRulesController);
