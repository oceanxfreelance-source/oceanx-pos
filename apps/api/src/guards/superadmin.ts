import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { superAdmins, superAdminSessions } from '../db/schema';
import { hashToken, safeEqual } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { clearSuperAdminCookie, LAST_SEEN_WRITE_INTERVAL_MS, superAdminCookieOptions, SUPERADMIN_COOKIE } from '../lib/sessions';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** All a phone-app sign-in (OceanX Admin) may do: its screen, payments to approve, its notifications, signing out. */
const PHONE_APP_ROUTES = new Set(
  [
    'GET /auth/session',
    'POST /auth/mfa',
    'POST /auth/logout',
    'GET /phone/summary',
    'GET /billing/summary',
    'GET /billing/payments',
    'GET /billing/payments/:id/slip',
    'POST /billing/payments/:id/approve',
    'POST /billing/payments/:id/reject',
    'GET /alerts/keys',
    'POST /alerts/keys',
    'DELETE /alerts/keys/:id',
  ].map((r) => r.replace(' /', ' /api/superadmin/')),
);

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
  const phoneApp = row.s.phoneApp;
  const idleMs = phoneApp ? config.SUPERADMIN_PHONE_IDLE_DAYS * 86_400_000 : config.SUPERADMIN_SESSION_IDLE_MINUTES * 60_000;
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
  // The phone app's lasting sign-in is for payments only: the rest of Super Admin needs a normal sign-in.
  if (phoneApp && !PHONE_APP_ROUTES.has(`${req.method === 'HEAD' ? 'GET' : req.method} ${req.routeOptions.url}`)) {
    throw new AppError('forbidden', 'Not available in the phone app');
  }

  if (!SAFE_METHODS.has(req.method)) {
    const header = req.headers['x-csrf-token'];
    if (typeof header !== 'string' || !safeEqual(header, row.s.csrfToken)) throw new AppError('csrf_invalid', 'Invalid CSRF token');
  }

  if (now - row.s.lastSeenAt.getTime() > LAST_SEEN_WRITE_INTERVAL_MS) {
    // Phone app: every use pushes the end further away (signed in until signing out, or a month unused).
    const renew = phoneApp && !row.s.mfaPending ? { expiresAt: new Date(now + config.SUPERADMIN_PHONE_ABSOLUTE_DAYS * 86_400_000) } : {};
    await db
      .update(superAdminSessions)
      .set({ lastSeenAt: new Date(), ...renew })
      .where(eq(superAdminSessions.id, row.s.id));
    if (renew.expiresAt) reply.setCookie(SUPERADMIN_COOKIE, token, superAdminCookieOptions(config, config.SUPERADMIN_PHONE_ABSOLUTE_DAYS * 86_400));
  }

  req.sa = {
    sessionId: row.s.id,
    csrfToken: row.s.csrfToken,
    mfaPending: row.s.mfaPending,
    phoneApp,
    admin: { id: row.a.id, name: row.a.name, email: row.a.email, totpEnabled: row.a.totpEnabled },
  };
}

export function saCtx(req: FastifyRequest) {
  if (!req.sa) throw new AppError('unauthenticated');
  return req.sa;
}
