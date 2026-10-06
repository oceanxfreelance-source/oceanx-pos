import { hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';

// OWASP-recommended Argon2id parameters (19 MiB, t=2, p=1).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

let dummyHash: Promise<string> | undefined;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(stored: string | null | undefined, plain: string): Promise<boolean> {
  if (!stored) {
    // Burn equivalent time when the account has no password / does not exist,
    // so response timing does not reveal which e-mail addresses are registered.
    dummyHash ??= hash(randomBytes(16).toString('hex'), OPTIONS);
    await verify(await dummyHash, plain).catch(() => false);
    return false;
  }
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}
