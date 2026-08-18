import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import {
  buildSupportThreadAssociationExample,
  buildSupportThreadAssociationStatus,
  previewSupportThreadAssociation,
} from './support-thread-association.model.js';

export function getSupportThreadAssociationStatus(_req: Request, res: Response) {
  return res.json(ok(buildSupportThreadAssociationStatus()));
}

export function getSupportThreadAssociationExample(_req: Request, res: Response) {
  return res.json(ok(buildSupportThreadAssociationExample()));
}

export function previewSupportThreadAssociationController(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(previewSupportThreadAssociation(req.body || {})));
  } catch (error) {
    return next(error);
  }
}
