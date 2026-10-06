import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { superAdminTokens, userTokens } from '../db/schema';
import { hashToken, randomToken } from '../lib/crypto';

type Purpose = 'reset' | 'invite';

const TTL_MINUTES: Record<'user' | 'super_admin', Record<Purpose, number>> = {
  user: { reset: 60, invite: 60 * 24 * 7 },
  super_admin: { reset: 30, invite: 60 * 24 * 2 },
};

/** Create a single-use token; any earlier unused tokens of the same purpose are invalidated. */
export async function issueUserToken(db: Executor, userId: string, purpose: Purpose): Promise<string> {
  const token = randomToken();
  await db
    .update(userTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(userTokens.userId, userId), eq(userTokens.purpose, purpose), isNull(userTokens.usedAt)));
  await db.insert(userTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TTL_MINUTES.user[purpose] * 60_000),
  });
  return token;
}

export async function consumeUserToken(db: Executor, token: string): Promise<{ userId: string; purpose: Purpose } | null> {
  const [row] = await db
    .update(userTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(userTokens.tokenHash, hashToken(token)), isNull(userTokens.usedAt), gt(userTokens.expiresAt, new Date())))
    .returning({ userId: userTokens.userId, purpose: userTokens.purpose });
  return row ?? null;
}

export async function issueSuperAdminToken(db: Executor, superAdminId: string, purpose: Purpose): Promise<string> {
  const token = randomToken();
  await db
    .update(superAdminTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(superAdminTokens.superAdminId, superAdminId), eq(superAdminTokens.purpose, purpose), isNull(superAdminTokens.usedAt)));
  await db.insert(superAdminTokens).values({
    superAdminId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TTL_MINUTES.super_admin[purpose] * 60_000),
  });
  return token;
}

export async function consumeSuperAdminToken(db: Executor, token: string): Promise<{ superAdminId: string; purpose: Purpose } | null> {
  const [row] = await db
    .update(superAdminTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(superAdminTokens.tokenHash, hashToken(token)), isNull(superAdminTokens.usedAt), gt(superAdminTokens.expiresAt, new Date())))
    .returning({ superAdminId: superAdminTokens.superAdminId, purpose: superAdminTokens.purpose });
  return row ?? null;
}
