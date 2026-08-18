import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportSensitiveTicketGuardExample,
  buildSupportSensitiveTicketGuardStatus,
  previewSupportSensitiveTicketGuard,
} from './support-sensitive-ticket-guard.model.js';

export function getSupportSensitiveTicketGuardStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportSensitiveTicketGuardStatus()));
}

export function getSupportSensitiveTicketGuardExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportSensitiveTicketGuardExample()));
}

export function previewSupportSensitiveTicketGuardController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(previewSupportSensitiveTicketGuard(req.body || {})));
  } catch (error) {
    return next(error);
  }
}
