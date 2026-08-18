import type { Request, Response, NextFunction } from 'express';
import { getDatabaseStatus } from '../../db/status.js';
import { ok } from '../../common/utils/api-response.js';

export async function databaseStatusController(_req: Request, res: Response, next: NextFunction) {
  try {
    const status = await getDatabaseStatus();
    res.json(ok(status));
  } catch (error) {
    next(error);
  }
}
