import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** URL-safe random token with 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Tokens are stored only as SHA-256 hashes — a DB leak does not leak live sessions. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** AES-256-GCM authenticated encryption for small secrets (e.g. TOTP seeds). */
export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

export function decryptSecret(payload: string, key: Buffer): string {
  const [v, iv, tag, data] = payload.split(':');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported secret format');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
