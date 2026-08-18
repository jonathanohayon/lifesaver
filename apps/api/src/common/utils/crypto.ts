import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

function getKey(): Buffer {
  // Derive a stable 32-byte encryption key from APP_ENCRYPTION_KEY.
  // Production should use a long random secret stored only in the hosting secret manager.
  return crypto.createHash('sha256').update(env.APP_ENCRYPTION_KEY).digest();
}

export function encryptSecret(plainText: string): string {
  if (!plainText || !plainText.trim()) {
    throw new Error('Cannot encrypt an empty secret.');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':');
}

export function decryptSecret(encryptedValue: string): string {
  const [version, ivB64, tagB64, encryptedB64] = encryptedValue.split(':');
  if (version !== VERSION || !ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Unsupported encrypted secret format.');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function secretHint(secret: string): string {
  const clean = String(secret || '').trim();
  if (!clean) return '';
  const last = clean.slice(-4);
  return `••••${last}`;
}
