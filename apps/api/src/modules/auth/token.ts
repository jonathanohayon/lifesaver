import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import type { AuthTokenPayload } from './auth.types.js';

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string): string {
  return crypto.createHmac('sha256', env.AUTH_TOKEN_SECRET).update(value).digest('base64url');
}

export function createAuthToken(payload: Omit<AuthTokenPayload, 'exp'>, expiresInSeconds = env.AUTH_TOKEN_TTL_SECONDS): string {
  const fullPayload: AuthTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'LIFE.SAVER' }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = sign(`${header}.${body}`);

  return `${header}.${body}.${signature}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format.');
  }

  const [header, body, signature] = parts;
  const expectedSignature = sign(`${header}.${body}`);
  const supplied = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    throw new Error('Invalid token signature.');
  }

  const payload = JSON.parse(base64UrlDecode(body)) as AuthTokenPayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired.');
  }

  return payload;
}
