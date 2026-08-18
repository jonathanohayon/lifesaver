import { Router } from 'express';
import {
  createSupportDraftActionController,
  getSupportDraftActionExample,
  getSupportDraftActionStatus,
  previewSupportDraftActionController,
} from './support-draft-action.controller.js';

export const supportDraftActionRouter = Router();

// Phase 12.5: convert a reviewed support draft into a proposed support_reply_send action only.
// No Gmail API client, no email sending, no support auto-reply, no external write.
supportDraftActionRouter.get('/draft-actions/status', getSupportDraftActionStatus);
supportDraftActionRouter.get('/draft-actions/example', getSupportDraftActionExample);
supportDraftActionRouter.post('/draft-actions/preview', previewSupportDraftActionController);
supportDraftActionRouter.post('/draft-actions/create', createSupportDraftActionController);
