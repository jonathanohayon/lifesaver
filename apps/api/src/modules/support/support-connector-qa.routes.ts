import { Router } from 'express';
import {
  getSupportConnectorQaReport,
  getSupportConnectorQaStatus,
  previewSupportConnectorQaReport,
} from './support-connector-qa.controller.js';

export const supportConnectorQaRouter = Router();

supportConnectorQaRouter.get('/qa/status', getSupportConnectorQaStatus);
supportConnectorQaRouter.get('/qa/report', getSupportConnectorQaReport);
supportConnectorQaRouter.post('/qa/report', previewSupportConnectorQaReport);
