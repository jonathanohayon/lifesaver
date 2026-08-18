import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

function sanitizeIncomingRequestId(value: string | undefined): string | null {
  if (!value) return null;
  const clean = value.trim();
  if (!clean) return null;
  if (clean.length > 80) return null;
  if (!/^[a-zA-Z0-9._:-]+$/.test(clean)) return null;
  return clean;
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = sanitizeIncomingRequestId(req.header('x-request-id'));
  const id = incoming || `req_${crypto.randomUUID()}`;
  (req as any).requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
