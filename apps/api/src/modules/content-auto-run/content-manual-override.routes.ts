import { Router } from 'express';
import {
  disableContentAutoRunManualOverride,
  getContentManualOverridePreview,
  getContentManualOverrideStatus,
} from './content-manual-override.controller.js';

export const contentManualOverrideRouter = Router();

// Phase 11.9: manual founder override for disabling the future content auto-run lane.
contentManualOverrideRouter.get('/manual-override/status', getContentManualOverrideStatus);
contentManualOverrideRouter.get('/manual-override/preview', getContentManualOverridePreview);
contentManualOverrideRouter.post('/manual-override/disable', disableContentAutoRunManualOverride);
