import { Router } from 'express';
import {
  getSupportThreadAssociationExample,
  getSupportThreadAssociationStatus,
  previewSupportThreadAssociationController,
} from './support-thread-association.controller.js';

export const supportThreadAssociationRouter = Router();

// Phase 13.4: thread-safe support reply handling. Preview-only endpoints; no Gmail API call and no email sending.
supportThreadAssociationRouter.get('/thread-association/status', getSupportThreadAssociationStatus);
supportThreadAssociationRouter.get('/thread-association/example', getSupportThreadAssociationExample);
supportThreadAssociationRouter.post('/thread-association/preview', previewSupportThreadAssociationController);
