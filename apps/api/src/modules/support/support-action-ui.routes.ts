import { Router } from 'express';
import {
  getSupportActionUiExample,
  getSupportActionUiStatus,
  previewSupportActionUi,
} from './support-action-ui.controller.js';

export const supportActionUiRouter = Router();

supportActionUiRouter.get('/action-ui/status', getSupportActionUiStatus);
supportActionUiRouter.get('/action-ui/example', getSupportActionUiExample);
supportActionUiRouter.post('/action-ui/preview', previewSupportActionUi);
