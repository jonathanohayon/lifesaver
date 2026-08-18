import { Router } from 'express';
import {
  getSupportPrivacySafeguardsExample,
  getSupportPrivacySafeguardsStatus,
  previewSupportPrivacySafeguardsController,
} from './support-privacy-safeguards.controller.js';

export const supportPrivacySafeguardsRouter = Router();

// Phase 12.6: privacy safeguards for support logs and browser-safe support previews.
// No Gmail API client, no email sending, no support auto-reply, no external write.
supportPrivacySafeguardsRouter.get('/privacy-safeguards/status', getSupportPrivacySafeguardsStatus);
supportPrivacySafeguardsRouter.get('/privacy-safeguards/example', getSupportPrivacySafeguardsExample);
supportPrivacySafeguardsRouter.post('/privacy-safeguards/preview', previewSupportPrivacySafeguardsController);
