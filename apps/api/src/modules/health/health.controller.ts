import type { Request, Response } from 'express';
import { ok } from '../../common/utils/api-response.js';

export function getHealth(_req: Request, res: Response) {
  return res.json(ok({
    status: 'ok',
    service: 'lifesaver-api',
    version: '0.8.5',
    mode: 'v2-functional-0-8-5-claude-backend-compatibility',
  }));
}
