import type { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../../modules/auth/token.js';

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) return next();

  try {
    (req as any).auth = verifyAuthToken(token);
  } catch (_error) {
    // Optional means we do not block public/local dashboard reads.
    // Protected routes still use authRequired and will reject bad tokens.
  }

  return next();
}
