import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError.js';
import { env } from '../../config/env.js';

function requestId(req: any): string | null {
  return typeof req.requestId === 'string' ? req.requestId : null;
}

function safeDetails(details: unknown): Record<string, unknown> | undefined {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('database_url') ||
      lowerKey.includes('encryption_key')
    ) {
      output[key] = '[redacted]';
      continue;
    }
    if (typeof value === 'string') output[key] = value.slice(0, 500);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) output[key] = value;
    else if (Array.isArray(value)) output[key] = value.slice(0, 20).map((item) => (typeof item === 'string' ? item.slice(0, 200) : item));
    else output[key] = value;
  }
  return output;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const id = requestId(req);
  const timestamp = new Date().toISOString();

  if (err instanceof AppError) {
    const details = safeDetails(err.details);
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        requestId: id,
        ...(details ? { details } : {}),
      },
      requestId: id,
      timestamp,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.errors[0]?.message || 'Invalid request body.',
        requestId: id,
      },
      requestId: id,
      timestamp,
    });
  }

  const safeMessage = env.NODE_ENV === 'production' ? 'Something went wrong.' : (err instanceof Error ? err.message : 'Something went wrong.');
  console.error('Unhandled error:', { requestId: id, error: err });
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: safeMessage,
      requestId: id,
    },
    requestId: id,
    timestamp,
  });
};
