import { Router } from 'express';
import {
  getSupportTicketClassifierExample,
  getSupportTicketClassifierStatus,
  previewSupportTicketClassifierController,
} from './support-ticket-classifier.controller.js';

export const supportTicketClassifierRouter = Router();

// Phase 12.4: deterministic ticket classifier. No Gmail API client, no sending, no support action creation.
supportTicketClassifierRouter.get('/ticket-classifier/status', getSupportTicketClassifierStatus);
supportTicketClassifierRouter.get('/ticket-classifier/example', getSupportTicketClassifierExample);
supportTicketClassifierRouter.post('/ticket-classifier/preview', previewSupportTicketClassifierController);
