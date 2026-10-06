import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { superAdmins, superAdminSessions } from '../db/schema';
import { hashToken, safeEqual } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { clearSuperAdminCookie, LAST_SEEN_WRITE_INTERVAL_MS, SUPERADMIN_COOKIE } from '../lib/sessions';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * SuperAdminGuard — authenticates ONLY via the super admin cookie against the
 * super_admin_sessions table. Business sessions are never consulted.
 */
export async function superAdminGuard(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { db, config } = req.server.deps;
  const token = req.cookies[SUPERADMIN_COOKIE];
  if (!token) throw new AppError('unauthenticated', 'Authentication required');

  const [row] = await db
    .select({ s: superAdminSessions, a: superAdmins })
    .from(superAdminSessions)
    .innerJoin(superAdmins, eq(superAdmins.id, superAdminSessions.superAdminId))
    .where(eq(superAdminSessions.tokenHash, hashToken(token)))
    .limit(1);

  const now = Date.now();
  if (!row || row.s.revokedAt) {
    clearSuperAdminCookie(reply, config);
    throw new AppError('unauthenticated', 'Authentication required');
  }
  const idleMs = config.SUPERADMIN_SESSION_IDLE_MINUTES * 60_000;
  if (row.s.expiresAt.getTime() < now || row.s.lastSeenAt.getTime() + idleMs < now) {
    await db.update(superAdminSessions).set({ revokedAt: new Date() }).where(eq(superAdminSessions.id, row.s.id));
    clearSuperAdminCookie(reply, config);
    throw new AppError('session_expired', 'Session expired');
  }
  if (!row.a.isActive) {
    await db.update(superAdminSessions).set({ revokedAt: new Date() }).where(eq(superAdminSessions.id, row.s.id));
    clearSuperAdminCookie(reply, config);
    throw new AppError('account_disabled', 'Account disabled');
  }
  if (row.s.mfaPending && !req.routeOptions.config.allowMfaPending) throw new AppError('mfa_required', 'Two-factor code required');

  if (!SAFE_METHODS.has(req.method)) {
    const header = req.headers['x-csrf-token'];
    if (typeof header !== 'string' || !safeEqual(header, row.s.csrfToken)) throw new AppError('csrf_invalid', 'Invalid CSRF token');
  }

  if (now - row.s.lastSeenAt.getTime() > LAST_SEEN_WRITE_INTERVAL_MS) {
    await db.update(superAdminSessions).set({ lastSeenAt: new Date() }).where(eq(superAdminSessions.id, row.s.id));
  }

  req.sa = {
    sessionId: row.s.id,
    csrfToken: row.s.csrfToken,
    mfaPending: row.s.mfaPending,
    admin: { id: row.a.id, name: row.a.name, email: row.a.email, totpEnabled: row.a.totpEnabled },
  };
}

export function saCtx(req: FastifyRequest) {
  if (!req.sa) throw new AppError('unauthenticated');
  return req.sa;
}
