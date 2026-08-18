import { Router } from 'express';
import {
  getSupportReadonlyImportStatus,
  importSupportReadonlyTicketsController,
  listSupportReadonlyTicketsController,
  previewSupportReadonlyImportController,
} from './support-readonly-import.controller.js';

export const supportReadonlyImportRouter = Router();

// Phase 12.2: read-only ticket import. No Gmail API client, no Gmail modify/send scope, no support reply sending.
supportReadonlyImportRouter.get('/read-only-import/status', getSupportReadonlyImportStatus);
supportReadonlyImportRouter.post('/read-only-import/preview', previewSupportReadonlyImportController);
supportReadonlyImportRouter.post('/read-only-import/import', importSupportReadonlyTicketsController);
supportReadonlyImportRouter.get('/tickets', listSupportReadonlyTicketsController);
