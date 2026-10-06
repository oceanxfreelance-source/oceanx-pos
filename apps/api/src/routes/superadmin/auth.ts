import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import * as OTPAuth from 'otpauth';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, mfaCodeSchema, resetPasswordSchema } from '@oceanx/shared';
import { z } from 'zod';
import { superAdmins, superAdminSessions } from '../../db/schema';
import { audit } from '../../lib/audit';
import { decryptSecret, encryptSecret, hashToken, randomToken } from '../../lib/crypto';
import { AppError, notFound } from '../../lib/errors';
import { hashPassword, verifyPassword } from '../../lib/password';
import { clearSuperAdminCookie, superAdminCookieOptions, SUPERADMIN_COOKIE } from '../../lib/sessions';
import { parse } from '../../lib/validation';
import { idParam } from '../../lib/params';
import { saCtx } from '../../guards/superadmin';
import { getPlatformSettings } from '../../services/platformSettings';
import { consumeSuperAdminToken, issueSuperAdminToken } from '../../services/tokens';

const TOTP_PERIOD = 30;

function totpFor(secretBase32: string, label: string, issuer: string) {
  return new OTPAuth.TOTP({ issuer, label, algorithm: 'SHA1', digits: 6, period: TOTP_PERIOD, secret: OTPAuth.Secret.fromBase32(secretBase32) });
}

/** Validate a TOTP code and return its time-step; rejects replays of an already used step. */
function verifyTotp(secretBase32: string, code: string, lastStep: number | null): number | null {
  const totp = totpFor(secretBase32, 'x', 'x');
  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 1000 / TOTP_PERIOD) + delta;
  if (lastStep !== null && step <= lastStep) return null;
  return step;
}

async function createSession(req: FastifyRequest, reply: FastifyReply, adminId: string, mfaPending: boolean) {
  const { db, config } = req.server.deps;
  const token = randomToken();
  const csrfToken = randomToken(24);
  const absoluteMs = config.SUPERADMIN_SESSION_ABSOLUTE_HOURS * 3_600_000;
  await db.insert(superAdminSessions).values({
    superAdminId: adminId,
    tokenHash: hashToken(token),
    csrfToken,
    mfaPending,
    ip: req.ip,
    userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
    expiresAt: new Date(Date.now() + absoluteMs),
  });
  reply.setCookie(SUPERADMIN_COOKIE, token, superAdminCookieOptions(config, Math.floor(absoluteMs / 1000)));
  return csrfToken;
}

function sessionPayload(a: { id: string; name: string; email: string; totpEnabled: boolean }, csrfToken: string, mfaPending: boolean) {
  return { admin: { id: a.id, name: a.name, email: a.email, totpEnabled: a.totpEnabled }, csrfToken, mfaPending };
}

async function registerFailure(req: FastifyRequest, admin: typeof superAdmins.$inferSelect) {
  const { db, config } = req.server.deps;
  const failures = admin.failedLoginCount + 1;
  const lock = failures >= config.LOGIN_MAX_FAILURES;
  await db
    .update(superAdmins)
    .set({ failedLoginCount: lock ? 0 : failures, lockedUntil: lock ? new Date(Date.now() + config.LOGIN_LOCK_MINUTES * 60_000) : null })
    .where(eq(superAdmins.id, admin.id));
  await audit(db, { actorType: 'super_admin', actorId: admin.id, action: 'superadmin.login_failed', req, metadata: { locked: lock } });
}

export async function superAdminAuthPublicRoutes(app: FastifyInstance, opts: { authRateLimit: number }) {
  const limited = { config: { rateLimit: { max: opts.authRateLimit, timeWindow: '1 minute' } } };
  const { db } = app.deps;

  app.post('/auth/login', limited, async (req, reply) => {
    const body = parse(loginSchema, req.body);
    const [admin] = await db.select().from(superAdmins).where(sql`lower(${superAdmins.email}) = ${body.email}`).limit(1);
    if (admin?.lockedUntil && admin.lockedUntil > new Date()) {
      await verifyPassword(null, body.password);
      throw new AppError('too_many_attempts', 'Too many failed attempts. Try again later.');
    }
    const ok = await verifyPassword(admin?.passwordHash, body.password);
    if (!admin || !ok) {
      if (admin) await registerFailure(req, admin);
      throw new AppError('invalid_credentials', 'Invalid email or password');
    }
    if (!admin.isActive) throw new AppError('account_disabled', 'Account disabled');

    const mfaPending = admin.totpEnabled;
    const csrfToken = await createSession(req, reply, admin.id, mfaPending);
    if (!mfaPending) {
      await db.update(superAdmins).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(superAdmins.id, admin.id));
      await audit(db, { actorType: 'super_admin', actorId: admin.id, actorName: admin.name, action: 'superadmin.login', req });
    }
    return sessionPayload(admin, csrfToken, mfaPending);
  });

  app.post('/auth/forgot-password', limited, async (req) => {
    const { mailer, config } = req.server.deps;
    const body = parse(forgotPasswordSchema, req.body);
    const [admin] = await db.select().from(superAdmins).where(sql`lower(${superAdmins.email}) = ${body.email}`).limit(1);
    if (admin?.isActive) {
      const token = await issueSuperAdminToken(db, admin.id, 'reset');
      await mailer.send({
        to: admin.email,
        subject: 'Super Admin password reset',
        text: `A password reset was requested for your Super Admin account.\n\nReset link (valid for 30 minutes):\n${config.APP_URL}/superadmin/reset-password?token=${token}\n\nIf you did not request this, secure your account immediately.`,
      });
      await audit(db, { actorType: 'super_admin', actorId: admin.id, action: 'superadmin.password_reset_requested', req });
    }
    return { ok: true };
  });

  app.post('/auth/reset-password', limited, async (req) => {
    const body = parse(resetPasswordSchema('superadmin'), req.body);
    await db.transaction(async (tx) => {
      const consumed = await consumeSuperAdminToken(tx, body.token);
      if (!consumed) throw new AppError('invalid_token', 'Link is invalid or has expired');
      await tx
        .update(superAdmins)
        .set({ passwordHash: await hashPassword(body.password), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null })
        .where(eq(superAdmins.id, consumed.superAdminId));
      await tx
        .update(superAdminSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(superAdminSessions.superAdminId, consumed.superAdminId), isNull(superAdminSessions.revokedAt)));
      await audit(tx, {
        actorType: 'super_admin',
        actorId: consumed.superAdminId,
        action: consumed.purpose === 'invite' ? 'superadmin.invite_accepted' : 'superadmin.password_reset',
        req,
      });
    });
    return { ok: true };
  });
}

export async function superAdminAuthSessionRoutes(app: FastifyInstance, opts: { authRateLimit: number }) {
  const { db, config } = app.deps;

  app.get('/auth/session', { config: { allowMfaPending: true } }, async (req) => {
    const ctx = saCtx(req);
    return sessionPayload(ctx.admin, ctx.csrfToken, ctx.mfaPending);
  });

  app.post(
    '/auth/mfa',
    { config: { allowMfaPending: true, rateLimit: { max: Math.min(opts.authRateLimit, 10), timeWindow: '1 minute' } } },
    async (req, reply) => {
      const ctx = saCtx(req);
      if (!ctx.mfaPending) return sessionPayload(ctx.admin, ctx.csrfToken, false);
      const { code } = parse(mfaCodeSchema, req.body);
      const [admin] = await db.select().from(superAdmins).where(eq(superAdmins.id, ctx.admin.id));
      if (!admin?.totpSecretEnc) throw new AppError('mfa_invalid');
      if (admin.lockedUntil && admin.lockedUntil > new Date()) throw new AppError('too_many_attempts', 'Too many failed attempts. Try again later.');
      const step = verifyTotp(decryptSecret(admin.totpSecretEnc, config.encryptionKey), code, admin.totpLastStep);
      if (step === null) {
        await registerFailure(req, admin);
        throw new AppError('mfa_invalid', 'Invalid code');
      }
      // Rotate the session after the second factor (prevents session fixation of a half-authenticated token).
      await db.update(superAdminSessions).set({ revokedAt: new Date() }).where(eq(superAdminSessions.id, ctx.sessionId));
      const csrfToken = await createSession(req, reply, admin.id, false);
      await db
        .update(superAdmins)
        .set({ totpLastStep: step, failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
        .where(eq(superAdmins.id, admin.id));
      await audit(db, { actorType: 'super_admin', actorId: admin.id, actorName: admin.name, action: 'superadmin.login', req, metadata: { mfa: true } });
      return sessionPayload(admin, csrfToken, false);
    },
  );

  app.post('/auth/logout', { config: { allowMfaPending: true } }, async (req, reply) => {
    const ctx = saCtx(req);
    await db.update(superAdminSessions).set({ revokedAt: new Date() }).where(eq(superAdminSessions.id, ctx.sessionId));
    clearSuperAdminCookie(reply, config);
    if (!ctx.mfaPending) await audit(db, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: 'superadmin.logout', req });
    return { ok: true };
  });

  app.post('/auth/change-password', async (req) => {
    const ctx = saCtx(req);
    const body = parse(changePasswordSchema('superadmin'), req.body);
    const [admin] = await db.select().from(superAdmins).where(eq(superAdmins.id, ctx.admin.id));
    if (!(await verifyPassword(admin?.passwordHash, body.currentPassword))) {
      throw new AppError('password_incorrect', 'Current password is incorrect', { fields: { currentPassword: { code: 'password_incorrect' } } }, 422);
    }
    if (body.currentPassword === body.newPassword) {
      throw new AppError('password_reuse', 'Choose a different password', { fields: { newPassword: { code: 'password_reuse' } } }, 422);
    }
    await db.update(superAdmins).set({ passwordHash: await hashPassword(body.newPassword), passwordChangedAt: new Date() }).where(eq(superAdmins.id, ctx.admin.id));
    await db
      .update(superAdminSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(superAdminSessions.superAdminId, ctx.admin.id), ne(superAdminSessions.id, ctx.sessionId), isNull(superAdminSessions.revokedAt)));
    await audit(db, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: 'superadmin.password_changed', req });
    return { ok: true };
  });

  // ------------------------------------------------------------ security: 2FA & sessions
  app.post('/security/2fa/setup', async (req) => {
    const ctx = saCtx(req);
    if (ctx.admin.totpEnabled) throw new AppError('mfa_already_enabled', '2FA already enabled');
    const secret = new OTPAuth.Secret({ size: 20 });
    await db.update(superAdmins).set({ totpSecretEnc: encryptSecret(secret.base32, config.encryptionKey) }).where(eq(superAdmins.id, ctx.admin.id));
    const { platformName } = await getPlatformSettings(db);
    const uri = totpFor(secret.base32, ctx.admin.email, `${platformName} Super Admin`).toString();
    return { secret: secret.base32, otpauthUri: uri };
  });

  app.post('/security/2fa/enable', async (req) => {
    const ctx = saCtx(req);
    const { code } = parse(mfaCodeSchema, req.body);
    const [admin] = await db.select().from(superAdmins).where(eq(superAdmins.id, ctx.admin.id));
    if (!admin?.totpSecretEnc) throw new AppError('mfa_not_enabled', 'Start 2FA setup first');
    if (admin.totpEnabled) throw new AppError('mfa_already_enabled');
    const step = verifyTotp(decryptSecret(admin.totpSecretEnc, config.encryptionKey), code, admin.totpLastStep);
    if (step === null) throw new AppError('mfa_invalid', 'Invalid code', { fields: { code: { code: 'mfa_invalid' } } }, 422);
    await db.update(superAdmins).set({ totpEnabled: true, totpLastStep: step }).where(eq(superAdmins.id, admin.id));
    await audit(db, { actorType: 'super_admin', actorId: admin.id, actorName: admin.name, action: 'superadmin.2fa_enabled', req });
    return { ok: true };
  });

  app.post('/security/2fa/disable', async (req) => {
    const ctx = saCtx(req);
    const body = parse(z.object({ password: z.string().min(1).max(256), code: z.string().regex(/^\d{6}$/) }), req.body);
    const [admin] = await db.select().from(superAdmins).where(eq(superAdmins.id, ctx.admin.id));
    if (!admin?.totpEnabled || !admin.totpSecretEnc) throw new AppError('mfa_not_enabled');
    if (!(await verifyPassword(admin.passwordHash, body.password))) {
      throw new AppError('password_incorrect', 'Password incorrect', { fields: { password: { code: 'password_incorrect' } } }, 422);
    }
    if (verifyTotp(decryptSecret(admin.totpSecretEnc, config.encryptionKey), body.code, admin.totpLastStep) === null) {
      throw new AppError('mfa_invalid', 'Invalid code', { fields: { code: { code: 'mfa_invalid' } } }, 422);
    }
    await db.update(superAdmins).set({ totpEnabled: false, totpSecretEnc: null, totpLastStep: null }).where(eq(superAdmins.id, admin.id));
    await audit(db, { actorType: 'super_admin', actorId: admin.id, actorName: admin.name, action: 'superadmin.2fa_disabled', req });
    return { ok: true };
  });

  app.get('/security/sessions', async (req) => {
    const ctx = saCtx(req);
    const rows = await db
      .select({
        id: superAdminSessions.id,
        ip: superAdminSessions.ip,
        userAgent: superAdminSessions.userAgent,
        createdAt: superAdminSessions.createdAt,
        lastSeenAt: superAdminSessions.lastSeenAt,
        expiresAt: superAdminSessions.expiresAt,
      })
      .from(superAdminSessions)
      .where(
        and(
          eq(superAdminSessions.superAdminId, ctx.admin.id),
          isNull(superAdminSessions.revokedAt),
          sql`${superAdminSessions.expiresAt} > now()`,
          eq(superAdminSessions.mfaPending, false),
        ),
      )
      .orderBy(desc(superAdminSessions.lastSeenAt))
      .limit(50);
    return { items: rows.map((r) => ({ ...r, current: r.id === ctx.sessionId })) };
  });

  app.delete('/security/sessions/:id', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const [row] = await db
      .update(superAdminSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(superAdminSessions.id, id), eq(superAdminSessions.superAdminId, ctx.admin.id)))
      .returning({ id: superAdminSessions.id });
    if (!row) throw notFound();
    await audit(db, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: 'superadmin.session_revoked', entityId: id, req });
    return { ok: true };
  });
}
