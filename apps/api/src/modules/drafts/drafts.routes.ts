import { Router } from 'express';
import { createContentDraftController, createSupportReplyDraftController, listDraftsController, updateDraftStatusController } from './drafts.controller.js';

export const draftsRouter = Router();

draftsRouter.get('/', listDraftsController);
draftsRouter.post('/content', createContentDraftController);
draftsRouter.post('/support-reply', createSupportReplyDraftController);
draftsRouter.patch('/:id/status', updateDraftStatusController);
