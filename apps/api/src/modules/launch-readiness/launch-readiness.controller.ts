import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';
import { getLaunchReadiness } from './launch-readiness.service.js';

export function getLaunchReadinessController(_req: Request, res: Response) {
  return res.json(ok(getLaunchReadiness()));
}
