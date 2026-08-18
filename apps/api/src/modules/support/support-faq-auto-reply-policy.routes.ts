import { Router } from 'express';
import {
  getSupportFaqAutoReplyPolicyExample,
  getSupportFaqAutoReplyPolicyStatus,
  previewSupportFaqAutoReplyPolicyController,
} from './support-faq-auto-reply-policy.controller.js';

export const supportFaqAutoReplyPolicyRouter = Router();

// Phase 13.5: FAQ auto-reply policy preview/evaluation only. No Gmail API call and no email sending.
supportFaqAutoReplyPolicyRouter.get('/faq-auto-reply-policy/status', getSupportFaqAutoReplyPolicyStatus);
supportFaqAutoReplyPolicyRouter.get('/faq-auto-reply-policy/example', getSupportFaqAutoReplyPolicyExample);
supportFaqAutoReplyPolicyRouter.post('/faq-auto-reply-policy/preview', previewSupportFaqAutoReplyPolicyController);
