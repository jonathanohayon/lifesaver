import crypto from 'node:crypto';

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_PREFIX = 'scrypt';

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt);
  return `${SCRYPT_PREFIX}$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash) return false;
  const [prefix, salt, hash] = storedHash.split('$');
  if (prefix !== SCRYPT_PREFIX || !salt || !hash) return false;

  const candidate = await scryptAsync(password, salt);
  const stored = Buffer.from(hash, 'hex');

  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}
