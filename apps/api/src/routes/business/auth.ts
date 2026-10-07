import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import {
  BUSINESS_TYPE_PROFILES,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerBusinessSchema,
  resetPasswordSchema,
} from '@oceanx/shared';
import { outlets, platformLanguages, plans, userOutlets, userSessions, users } from '../../db/schema';
import { audit } from '../../lib/audit';
import { hashToken, randomToken } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { hashPassword, verifyPassword } from '../../lib/password';
import { BUSINESS_COOKIE, businessCookieOptions, clearBusinessCookie } from '../../lib/sessions';
import { parse } from '../../lib/validation';
import { authenticateBusiness, bizCtx } from '../../guards/business';
import { loadBusinessAccess } from '../../services/access';
import { getPlatformSettings } from '../../services/platformSettings';
import { loadBusinessSettings } from '../../services/settings';
import { provisionBusiness } from '../../services/provisioning';
import { consumeUserToken, issueUserToken } from '../../services/tokens';
import type { BusinessContext } from '../../types';

export async function buildSessionPayload(req: FastifyRequest, ctx: BusinessContext) {
  const { db } = req.server.deps;
  const assigned = await db.select({ id: userOutlets.outletId }).from(userOutlets).where(eq(userOutlets.userId, ctx.user.id));
  const all = await db
    .select({ id: outlets.id, name: outlets.name, isDefault: outlets.isDefault })
    .from(outlets)
    .where(and(eq(outlets.businessId, ctx.businessId), eq(outlets.isActive, true)))
    .orderBy(outlets.createdAt);
  const assignedIds = new Set(assigned.map((a) => a.id));
  const accessibleOutlets = assignedIds.size ? all.filter((o) => assignedIds.has(o.id)) : all;
  const languages = await enabledLanguages(req);
  const settings = await loadBusinessSettings(db, ctx.businessId);
  const b = ctx.access.business;
  return {
    csrfToken: ctx.csrfToken,
    state: ctx.access.state,
    user: ctx.user,
    business: {
      id: b.id,
      name: b.name,
      slug: b.slug,
      businessType: b.businessType,
      status: b.status,
      currency: b.currency,
      timezone: b.timezone,
      hasLogo: !!b.logoPath,
      onboardingCompleted: !!b.onboardingCompletedAt,
      profile: BUSINESS_TYPE_PROFILES[b.businessType],
      suspensionReason: b.status === 'suspended' ? b.suspensionReason : null,
    },
    subscription: ctx.access.subscription,
    limits: ctx.access.limits,
    modules: [...ctx.access.modules],
    addons: [...ctx.access.addons],
    permissions: [...ctx.permissions].sort(),
    outlet: accessibleOutlets.find((o) => o.id === ctx.outletId) ?? null,
    outlets: accessibleOutlets,
    languages,
    regional: {
      currencySymbol: settings.regional.currencySymbol,
      currencyDecimals: settings.regional.currencyDecimals,
      dateFormat: settings.regional.dateFormat,
      timeFormat: settings.regional.timeFormat,
    },
    pos: settings.pos,
    /** Tax config (not secret) lets editors show a live preview; the server recalculates on save. */
    tax: settings.tax,
    /** Viber Credit messages are active only when both the platform and the manager enabled them. */
    viberCredit: { available: ctx.access.business.superadminViberCreditEnabled, active: ctx.access.business.superadminViberCreditEnabled && ctx.access.business.managerViberCreditEnabled },
  };
}

async function enabledLanguages(req: FastifyRequest) {
  return req.server.deps.db
    .select({ code: platformLanguages.code, nativeName: platformLanguages.nativeName, direction: platformLanguages.direction, isDefault: platformLanguages.isDefault })
    .from(platformLanguages)
    .where(eq(platformLanguages.isEnabled, true))
    .orderBy(platformLanguages.sortOrder);
}

async function startSession(req: FastifyRequest, reply: FastifyReply, user: { id: string; businessId: string; defaultOutletId: string | null }) {
  const { db, config } = req.server.deps;
  const token = randomToken();
  const csrfToken = randomToken(24);
  const absoluteMs = config.BUSINESS_SESSION_ABSOLUTE_HOURS * 3_600_000;
  await db.insert(userSessions).values({
    userId: user.id,
    businessId: user.businessId,
    tokenHash: hashToken(token),
    csrfToken,
    currentOutletId: user.defaultOutletId,
    ip: req.ip,
    userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
    expiresAt: new Date(Date.now() + absoluteMs),
  });
  reply.setCookie(BUSINESS_COOKIE, token, businessCookieOptions(config, Math.floor(absoluteMs / 1000)));
  // Make the fresh cookie visible to the guard for the payload below.
  req.cookies[BUSINESS_COOKIE] = token;
}

export async function businessAuthPublicRoutes(app: FastifyInstance, opts: { authRateLimit: number }) {
  const limited = { config: { rateLimit: { max: opts.authRateLimit, timeWindow: '1 minute' } } };

  /** Public: languages enabled by the platform (login page language picker). */
  app.get('/languages', async (req) => ({ items: await enabledLanguages(req) }));

  app.post('/auth/login', limited, async (req, reply) => {
    const { db, config } = req.server.deps;
    const body = parse(loginSchema, req.body);
    const [user] = await db
      .select()
      .from(users)
      .where(and(sql`lower(${users.email}) = ${body.email}`, isNull(users.deletedAt)))
      .limit(1);

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      await verifyPassword(null, body.password);
      throw new AppError('too_many_attempts', 'Too many failed attempts. Try again later.');
    }
    const ok = await verifyPassword(user?.passwordHash, body.password);
    if (!user || !ok) {
      if (user) {
        const failures = user.failedLoginCount + 1;
        const lock = failures >= config.LOGIN_MAX_FAILURES;
        await db
          .update(users)
          .set({ failedLoginCount: lock ? 0 : failures, lockedUntil: lock ? new Date(Date.now() + config.LOGIN_LOCK_MINUTES * 60_000) : null })
          .where(eq(users.id, user.id));
        await audit(db, { actorType: 'user', actorId: user.id, businessId: user.businessId, action: 'user.login_failed', req, metadata: { locked: lock } });
      }
      throw new AppError('invalid_credentials', 'Invalid email or password');
    }
    if (!user.isActive) throw new AppError('account_disabled', 'Account disabled');

    const access = await loadBusinessAccess(db, user.businessId);
    if (!access) throw new AppError('invalid_credentials', 'Invalid email or password');
    if (access.state === 'business_suspended' || access.state === 'business_deactivated') {
      throw new AppError(access.state, 'Business is not active', { details: { reason: access.business.suspensionReason } });
    }

    await db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await startSession(req, reply, user);
    await audit(db, { actorType: 'user', actorId: user.id, actorName: user.name, businessId: user.businessId, action: 'user.login', req });
    return buildSessionPayload(req, await authenticateBusiness(req, reply, { csrf: false, enforceState: false }));
  });

  app.post('/auth/forgot-password', limited, async (req) => {
    const { db, mailer, config } = req.server.deps;
    const body = parse(forgotPasswordSchema, req.body);
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, isActive: users.isActive, businessId: users.businessId })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${body.email}`, isNull(users.deletedAt)))
      .limit(1);
    // Always respond identically to avoid revealing which e-mails exist.
    if (user?.isActive) {
      const token = await issueUserToken(db, user.id, 'reset');
      await mailer.send({
        to: user.email,
        subject: 'Reset your password',
        text: `Hello ${user.name},\n\nReset your password using this link (valid for 60 minutes):\n${config.APP_URL}/reset-password?token=${token}\n\nIf you did not request this, ignore this e-mail.`,
      });
      await audit(db, { actorType: 'user', actorId: user.id, businessId: user.businessId, action: 'user.password_reset_requested', req });
    }
    return { ok: true };
  });

  /** Used for both password reset and invitation acceptance. */
  app.post('/auth/reset-password', limited, async (req) => {
    const { db } = req.server.deps;
    const body = parse(resetPasswordSchema('business'), req.body);
    const result = await db.transaction(async (tx) => {
      const consumed = await consumeUserToken(tx, body.token);
      if (!consumed) throw new AppError('invalid_token', 'Link is invalid or has expired');
      const [user] = await tx
        .update(users)
        .set({ passwordHash: await hashPassword(body.password), passwordChangedAt: new Date(), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null })
        .where(and(eq(users.id, consumed.userId), isNull(users.deletedAt)))
        .returning({ id: users.id, businessId: users.businessId });
      if (!user) throw new AppError('invalid_token', 'Link is invalid or has expired');
      // Invalidate every existing session after a credential change.
      await tx.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.userId, user.id), isNull(userSessions.revokedAt)));
      await audit(tx, {
        actorType: 'user',
        actorId: user.id,
        businessId: user.businessId,
        action: consumed.purpose === 'invite' ? 'user.invite_accepted' : 'user.password_reset',
        req,
      });
      return user;
    });
    return { ok: true, userId: result.id };
  });

  app.post('/auth/register', limited, async (req, reply) => {
    const { db } = req.server.deps;
    const settings = await getPlatformSettings(db);
    if (settings.registrationMode === 'closed') throw new AppError('registration_closed', 'Registration is closed');
    const body = parse(registerBusinessSchema, req.body);
    const [plan] = await db.select().from(plans).where(and(eq(plans.code, settings.defaultPlanCode), eq(plans.isActive, true))).limit(1);
    if (!plan) throw new AppError('registration_closed', 'Registration is not configured');

    const passwordHash = await hashPassword(body.password);
    const { business, owner } = await db.transaction(async (tx) => {
      const res = await provisionBusiness(tx, {
        name: body.businessName,
        businessType: body.businessType,
        email: body.email,
        phone: body.phone,
        currency: body.currency,
        status: settings.registrationMode === 'open' ? 'active' : 'pending',
        planId: plan.id,
        owner: { name: body.ownerName, email: body.email, language: body.language, passwordHash, phone: body.phone },
      });
      await audit(tx, {
        actorType: 'user',
        actorId: res.owner.id,
        actorName: res.owner.name,
        businessId: res.business.id,
        action: 'business.registered',
        entityType: 'business',
        entityId: res.business.id,
        req,
      });
      return res;
    });
    await startSession(req, reply, owner);
    const ctx = await authenticateBusiness(req, reply, { csrf: false, enforceState: false });
    reply.status(201);
    return { ...(await buildSessionPayload(req, ctx)), registeredBusinessId: business.id };
  });
}

export async function businessAuthSessionRoutes(app: FastifyInstance) {
  const sessionOnly = { config: { sessionOnly: true } };

  app.get('/auth/session', sessionOnly, async (req) => buildSessionPayload(req, bizCtx(req)));

  app.post('/auth/logout', sessionOnly, async (req, reply) => {
    const ctx = bizCtx(req);
    const { db, config } = req.server.deps;
    await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.id, ctx.sessionId));
    clearBusinessCookie(reply, config);
    await audit(db, { actorType: 'user', actorId: ctx.user.id, actorName: ctx.user.name, businessId: ctx.businessId, action: 'user.logout', req });
    return { ok: true };
  });

  app.post('/auth/change-password', sessionOnly, async (req) => {
    const ctx = bizCtx(req);
    const { db } = req.server.deps;
    const body = parse(changePasswordSchema('business'), req.body);
    const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!(await verifyPassword(user?.passwordHash, body.currentPassword))) {
      throw new AppError('password_incorrect', 'Current password is incorrect', { fields: { currentPassword: { code: 'password_incorrect' } } }, 422);
    }
    if (body.currentPassword === body.newPassword) {
      throw new AppError('password_reuse', 'Choose a different password', { fields: { newPassword: { code: 'password_reuse' } } }, 422);
    }
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash: await hashPassword(body.newPassword), passwordChangedAt: new Date(), mustChangePassword: false })
        .where(eq(users.id, ctx.user.id));
      // Keep this session, revoke all others.
      await tx
        .update(userSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(userSessions.userId, ctx.user.id), ne(userSessions.id, ctx.sessionId), isNull(userSessions.revokedAt)));
      await audit(tx, { actorType: 'user', actorId: ctx.user.id, actorName: ctx.user.name, businessId: ctx.businessId, action: 'user.password_changed', req });
    });
    return { ok: true };
  });
}

