import type { Request, Response, NextFunction } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getSecurityStatus } from './security.service.js';

export async function getSecurityStatusController(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(ok(getSecurityStatus()));
  } catch (error) {
    return next(error);
  }
}
