import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportTicketSchemaExample,
  buildSupportTicketSchemaPreview,
  buildSupportTicketSchemaStatus,
} from './support-ticket-schema.model.js';

export function getSupportTicketSchemaStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportTicketSchemaStatus()));
}

export function getSupportTicketSchemaExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportTicketSchemaExample()));
}

export function previewSupportTicketSchemaController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(buildSupportTicketSchemaPreview(req.body)));
  } catch (error) {
    return next(error);
  }
}
