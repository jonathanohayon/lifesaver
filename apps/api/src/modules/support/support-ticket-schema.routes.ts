import { Router } from 'express';
import {
  getSupportTicketSchemaExample,
  getSupportTicketSchemaStatus,
  previewSupportTicketSchemaController,
} from './support-ticket-schema.controller.js';

export const supportTicketSchemaRouter = Router();

// Phase 12.3: canonical support ticket schema. No Gmail API client, no send scope, no support reply sending.
supportTicketSchemaRouter.get('/ticket-schema/status', getSupportTicketSchemaStatus);
supportTicketSchemaRouter.get('/ticket-schema/example', getSupportTicketSchemaExample);
supportTicketSchemaRouter.post('/ticket-schema/preview', previewSupportTicketSchemaController);
