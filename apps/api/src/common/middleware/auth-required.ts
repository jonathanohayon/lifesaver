import type { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../../modules/auth/token.js';

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Please log in to continue.' },
    });
    return;
  }

  try {
    (req as any).auth = verifyAuthToken(token);
    next();
  } catch (_error) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Session expired or invalid. Please log in again.' },
    });
  }
}
