import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportTicketClassifierExample,
  buildSupportTicketClassifierPreview,
  buildSupportTicketClassifierStatus,
} from './support-ticket-classifier.model.js';

export function getSupportTicketClassifierStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportTicketClassifierStatus()));
}

export function getSupportTicketClassifierExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportTicketClassifierExample()));
}

export function previewSupportTicketClassifierController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildSupportTicketClassifierPreview(req.body)));
  } catch (error) {
    return next(error);
  }
}
