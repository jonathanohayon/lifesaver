import { Router } from 'express';
import { getContentActionDigestPreview, getContentActionDigestStatus } from './content-action-digest.controller.js';

export const contentActionDigestRouter = Router();

// Phase 11.7: read-only content action digest for future Daily Brief integration.
contentActionDigestRouter.get('/action-digest/status', getContentActionDigestStatus);
contentActionDigestRouter.get('/action-digest/preview', getContentActionDigestPreview);
