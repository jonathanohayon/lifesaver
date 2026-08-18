import { Router } from 'express';
import { getContentFinalPublishValidationPreview, getContentFinalPublishValidationStatus } from './content-final-publish-validator.controller.js';

export const contentFinalPublishValidatorRouter = Router();

// Phase 11.6: read-only final pre-publish validator. Mounted behind authRequired in api-v1.ts.
contentFinalPublishValidatorRouter.get('/final-validator/status', getContentFinalPublishValidationStatus);
contentFinalPublishValidatorRouter.get('/final-validator/preview', getContentFinalPublishValidationPreview);
