import { Router } from 'express';
import {
  getSupportSensitiveTicketGuardExample,
  getSupportSensitiveTicketGuardStatus,
  previewSupportSensitiveTicketGuardController,
} from './support-sensitive-ticket-guard.controller.js';

export const supportSensitiveTicketGuardRouter = Router();

// Phase 13.7: sensitive-ticket guard preview only. No Gmail API call and no email sending.
supportSensitiveTicketGuardRouter.get('/sensitive-ticket-guard/status', getSupportSensitiveTicketGuardStatus);
supportSensitiveTicketGuardRouter.get('/sensitive-ticket-guard/example', getSupportSensitiveTicketGuardExample);
supportSensitiveTicketGuardRouter.post('/sensitive-ticket-guard/preview', previewSupportSensitiveTicketGuardController);
