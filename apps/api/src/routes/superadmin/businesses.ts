import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  BUSINESS_TYPES,
  changePlanSchema,
  createBusinessSchema,
  extendSubscriptionSchema,
  paginationQuerySchema,
  suspendBusinessSchema,
  updateBusinessSchema,
} from '@oceanx/shared';
import type { Executor } from '../../db/client';
import { activityLogs, addons, businessAddons, businesses, outlets, plans, subscriptions, users, userSessions } from '../../db/schema';
import { saCtx } from '../../guards/superadmin';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { parse } from '../../lib/validation';
import { effectiveSubscriptionStatus } from '../../services/access';
import { provisionBusiness } from '../../services/provisioning';
import { issueUserToken } from '../../services/tokens';

const listQuerySchema = paginationQuerySchema.extend({
  type: z.enum(BUSINESS_TYPES).optional(),
  status: z.enum(['pending', 'active', 'suspended', 'deactivated']).optional(),
  subscription: z.enum(['trialing', 'active', 'expired']).optional(),
});

type Status = 'pending' | 'active' | 'suspended' | 'deactivated';
const TRANSITIONS: Record<string, { from: Status[]; to: Status; action: string }> = {
  approve: { from: ['pending'], to: 'active', action: 'superadmin.business_approved' },
  activate: { from: ['suspended', 'deactivated'], to: 'active', action: 'superadmin.business_activated' },
  suspend: { from: ['pending', 'active'], to: 'suspended', action: 'superadmin.business_suspended' },
  deactivate: { from: ['pending', 'active', 'suspended'], to: 'deactivated', action: 'superadmin.business_deactivated' },
};

async function loadBusiness(db: Executor, id: string) {
  const [b] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, id), isNull(businesses.deletedAt)))
    .limit(1);
  if (!b) throw notFound();
  return b;
}

async function sendOwnerInvite(req: FastifyRequest, db: Executor, owner: { id: string; email: string; name: string }, businessName: string) {
  const { mailer, config } = req.server.deps;
  const token = await issueUserToken(db, owner.id, 'invite');
  await mailer.send({
    to: owner.email,
    subject: `You're invited to manage ${businessName}`,
    text: `Hello ${owner.name},\n\nAn account has been created for you as the administrator of ${businessName}.\nSet your password here (valid for 7 days):\n${config.APP_URL}/reset-password?token=${token}&invite=1\n`,
  });
}

export async function businessAdminRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  app.get('/businesses', async (req) => {
    const q = parse(listQuerySchema, req.query);
    const subFilter =
      q.subscription === 'expired'
        ? sql`(${subscriptions.status} IN ('expired','cancelled') OR ${subscriptions.currentPeriodEnd} < now())`
        : q.subscription
          ? sql`(${subscriptions.status} = ${q.subscription} AND ${subscriptions.currentPeriodEnd} >= now())`
          : undefined;
    const where = and(
      isNull(businesses.deletedAt),
      q.q ? or(ilike(businesses.name, `%${q.q}%`), ilike(businesses.email, `%${q.q}%`), ilike(businesses.slug, `%${q.q}%`)) : undefined,
      q.type ? eq(businesses.businessType, q.type) : undefined,
      q.status ? eq(businesses.status, q.status) : undefined,
      subFilter,
    );
    const base = db
      .select({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        businessType: businesses.businessType,
        status: businesses.status,
        email: businesses.email,
        createdAt: businesses.createdAt,
        planName: plans.name,
        subscriptionStatus: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        viberCreditRequested: sql<boolean>`(${businesses.viberCreditRequestedAt} IS NOT NULL AND NOT ${businesses.superadminViberCreditEnabled})`,
      })
      .from(businesses)
      .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .where(where);
    const [items, [total]] = await Promise.all([
      base
        .orderBy(desc(businesses.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db
        .select({ n: count() })
        .from(businesses)
        .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
        .where(where),
    ]);
    const ids = items.map((i) => i.id);
    const userCounts = ids.length
      ? await db
          .select({ businessId: users.businessId, n: count() })
          .from(users)
          .where(and(inArray(users.businessId, ids), isNull(users.deletedAt)))
          .groupBy(users.businessId)
      : [];
    return {
      items: items.map((i) => ({
        ...i,
        effectiveSubscriptionStatus: i.subscriptionStatus && i.currentPeriodEnd ? effectiveSubscriptionStatus(i.subscriptionStatus, i.currentPeriodEnd) : null,
        userCount: Number(userCounts.find((u) => u.businessId === i.id)?.n ?? 0),
      })),
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total?.n ?? 0),
    };
  });

  app.post('/businesses', async (req, reply) => {
    const ctx = saCtx(req);
    const body = parse(createBusinessSchema, req.body);
    const result = await db.transaction(async (tx) => {
      const res = await provisionBusiness(tx, {
        ...body,
        status: 'active',
        createdBySuperAdminId: ctx.admin.id,
        owner: { ...body.owner, passwordHash: null },
      });
      await sendOwnerInvite(req, tx, res.owner, res.business.name);
      await audit(tx, {
        actorType: 'super_admin',
        actorId: ctx.admin.id,
        actorName: ctx.admin.name,
        businessId: res.business.id,
        action: 'superadmin.business_created',
        entityType: 'business',
        entityId: res.business.id,
        metadata: { name: res.business.name, type: res.business.businessType, plan: res.plan.code, ownerEmail: res.owner.email },
        req,
      });
      return res;
    });
    reply.status(201);
    return { id: result.business.id, ownerInviteSent: true };
  });

  app.get('/businesses/:id', async (req) => {
    const id = idParam(req);
    const b = await loadBusiness(db, id);
    const [[sub], addonRows, [userCount], [outletCount], [owner], activity] = await Promise.all([
      db
        .select({ sub: subscriptions, plan: plans })
        .from(subscriptions)
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .where(eq(subscriptions.businessId, id)),
      db
        .select({
          code: addons.code,
          name: addons.name,
          isActive: addons.isActive,
          status: businessAddons.status,
          grantedAt: businessAddons.grantedAt,
          revokedAt: businessAddons.revokedAt,
          expiresAt: businessAddons.expiresAt,
        })
        .from(addons)
        .leftJoin(businessAddons, and(eq(businessAddons.addonId, addons.id), eq(businessAddons.businessId, id)))
        .orderBy(addons.name),
      db
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.businessId, id), isNull(users.deletedAt))),
      db.select({ n: count() }).from(outlets).where(eq(outlets.businessId, id)),
      db
        .select({ id: users.id, name: users.name, email: users.email, lastLoginAt: users.lastLoginAt, hasPassword: sql<boolean>`${users.passwordHash} IS NOT NULL` })
        .from(users)
        .where(and(eq(users.businessId, id), eq(users.isOwner, true), isNull(users.deletedAt))),
      // Platform-level history only (Super Admin actions) — tenant operational logs stay private to the business.
      db
        .select()
        .from(activityLogs)
        .where(and(eq(activityLogs.businessId, id), or(eq(activityLogs.actorType, 'super_admin'), eq(activityLogs.action, 'business.registered'))))
        .orderBy(desc(activityLogs.createdAt))
        .limit(20),
    ]);
    return {
      business: b,
      subscription: sub
        ? { ...sub.sub, effectiveStatus: effectiveSubscriptionStatus(sub.sub.status, sub.sub.currentPeriodEnd), plan: sub.plan }
        : null,
      addons: addonRows,
      userCount: Number(userCount?.n ?? 0),
      outletCount: Number(outletCount?.n ?? 0),
      owner: owner ?? null,
      activity,
    };
  });

  app.patch('/businesses/:id', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const body = parse(updateBusinessSchema, req.body);
    await loadBusiness(db, id);
    await db.update(businesses).set({ ...body, updatedAt: new Date() }).where(eq(businesses.id, id));
    await audit(db, {
      actorType: 'super_admin',
      actorId: ctx.admin.id,
      actorName: ctx.admin.name,
      businessId: id,
      action: 'superadmin.business_updated',
      entityType: 'business',
      entityId: id,
      metadata: { fields: Object.keys(body) },
      req,
    });
    return { ok: true };
  });

  for (const [verb, t] of Object.entries(TRANSITIONS)) {
    app.post(`/businesses/:id/${verb}`, async (req) => {
      const ctx = saCtx(req);
      const id = idParam(req);
      const reason = verb === 'suspend' ? parse(suspendBusinessSchema, req.body).reason : null;
      await db.transaction(async (tx) => {
        const b = await loadBusiness(tx, id);
        if (!t.from.includes(b.status)) throw new AppError('invalid_status_transition', `Cannot ${verb} a ${b.status} business`);
        const now = new Date();
        await tx
          .update(businesses)
          .set({
            status: t.to,
            updatedAt: now,
            ...(verb === 'approve' ? { approvedAt: now } : {}),
            ...(t.to === 'suspended' ? { suspendedAt: now, suspensionReason: reason } : {}),
            ...(t.to === 'active' ? { suspendedAt: null, suspensionReason: null } : {}),
          })
          .where(eq(businesses.id, id));
        if (t.to === 'suspended' || t.to === 'deactivated') {
          await tx.update(userSessions).set({ revokedAt: now }).where(and(eq(userSessions.businessId, id), isNull(userSessions.revokedAt)));
        }
        await audit(tx, {
          actorType: 'super_admin',
          actorId: ctx.admin.id,
          actorName: ctx.admin.name,
          businessId: id,
          action: t.action,
          entityType: 'business',
          entityId: id,
          metadata: { from: b.status, to: t.to, reason },
          req,
        });
      });
      return { ok: true, status: t.to };
    });
  }

  app.post('/businesses/:id/subscription/change-plan', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const body = parse(changePlanSchema, req.body);
    await db.transaction(async (tx) => {
      await loadBusiness(tx, id);
      const [plan] = await tx.select().from(plans).where(eq(plans.id, body.planId));
      if (!plan) throw new AppError('validation_failed', 'Unknown plan', { fields: { planId: { code: 'invalid_option' } } });
      const [current] = await tx
        .select({ sub: subscriptions, planCode: plans.code })
        .from(subscriptions)
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .where(eq(subscriptions.businessId, id));
      const days = body.status === 'trialing' ? Math.max(plan.trialDays, 1) : 30;
      const periodEnd = body.periodEnd ? new Date(body.periodEnd) : new Date(Date.now() + days * 86_400_000);
      if (current) {
        await tx
          .update(subscriptions)
          .set({ planId: plan.id, status: body.status, currentPeriodEnd: periodEnd, updatedAt: new Date() })
          .where(eq(subscriptions.businessId, id));
      } else {
        await tx.insert(subscriptions).values({ businessId: id, planId: plan.id, status: body.status, currentPeriodEnd: periodEnd });
      }
      await audit(tx, {
        actorType: 'super_admin',
        actorId: ctx.admin.id,
        actorName: ctx.admin.name,
        businessId: id,
        action: 'superadmin.plan_changed',
        entityType: 'subscription',
        entityId: id,
        metadata: { from: current?.planCode ?? null, to: plan.code, status: body.status, periodEnd: periodEnd.toISOString() },
        req,
      });
    });
    return { ok: true };
  });

  app.post('/businesses/:id/subscription/extend', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const { days } = parse(extendSubscriptionSchema, req.body);
    const updated = await db.transaction(async (tx) => {
      const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.businessId, id)).for('update');
      if (!sub) throw notFound();
      const base = Math.max(Date.now(), sub.currentPeriodEnd.getTime());
      const currentPeriodEnd = new Date(base + days * 86_400_000);
      const status = sub.status === 'expired' || sub.status === 'cancelled' ? 'active' : sub.status;
      await tx.update(subscriptions).set({ currentPeriodEnd, status, updatedAt: new Date() }).where(eq(subscriptions.id, sub.id));
      await audit(tx, {
        actorType: 'super_admin',
        actorId: ctx.admin.id,
        actorName: ctx.admin.name,
        businessId: id,
        action: 'superadmin.subscription_extended',
        entityType: 'subscription',
        entityId: sub.id,
        metadata: { days, from: sub.currentPeriodEnd.toISOString(), to: currentPeriodEnd.toISOString() },
        req,
      });
      return { currentPeriodEnd, status };
    });
    return { ok: true, ...updated };
  });

  /**
   * Feature: Viber Credit messaging (superadmin_viber_credit_enabled). Enabling only makes the feature
   * available — the business manager still decides whether to turn it on. Disabling stops all messages.
   */
  app.post('/businesses/:id/features/viber-credit', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const { enabled } = parse(z.object({ enabled: z.boolean() }), req.body);
    const b = await db.transaction(async (tx) => {
      await loadBusiness(tx, id);
      const [u] = await tx.update(businesses).set({ superadminViberCreditEnabled: enabled, updatedAt: new Date() }).where(eq(businesses.id, id)).returning();
      await audit(tx, {
        actorType: 'super_admin',
        actorId: ctx.admin.id,
        actorName: ctx.admin.name,
        businessId: id,
        action: enabled ? 'superadmin.viber_credit_enabled' : 'superadmin.viber_credit_disabled',
        entityType: 'business',
        entityId: id,
        req,
      });
      return u!;
    });
    return {
      superadminEnabled: b.superadminViberCreditEnabled,
      managerEnabled: b.managerViberCreditEnabled,
      requestedAt: b.viberCreditRequestedAt,
      active: b.superadminViberCreditEnabled && b.managerViberCreditEnabled,
    };
  });

  app.post<{ Params: { id: string; code: string } }>('/businesses/:id/addons/:code/grant', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const body = parse(z.object({ expiresAt: z.iso.datetime().nullable().optional() }), req.body ?? {});
    await db.transaction(async (tx) => {
      await loadBusiness(tx, id);
      const [addon] = await tx.select().from(addons).where(eq(addons.code, req.params.code));
      if (!addon) throw notFound();
      const values = {
        status: 'active' as const,
        grantedAt: new Date(),
        grantedBy: ctx.admin.id,
        revokedAt: null,
        revokedBy: null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        updatedAt: new Date(),
      };
      await tx
        .insert(businessAddons)
        .values({ businessId: id, addonId: addon.id, ...values })
        .onConflictDoUpdate({ target: [businessAddons.businessId, businessAddons.addonId], set: values });
      await audit(tx, {
        actorType: 'super_admin',
        actorId: ctx.admin.id,
        actorName: ctx.admin.name,
        businessId: id,
        action: 'superadmin.addon_granted',
        entityType: 'addon',
        entityId: addon.code,
        metadata: { expiresAt: values.expiresAt },
        req,
      });
    });
    return { ok: true };
  });

  app.post<{ Params: { id: string; code: string } }>('/businesses/:id/addons/:code/revoke', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    await db.transaction(async (tx) => {
      const [addon] = await tx.select().from(addons).where(eq(addons.code, req.params.code));
      if (!addon) throw notFound();
      const [row] = await tx
        .update(businessAddons)
        .set({ status: 'revoked', revokedAt: new Date(), revokedBy: ctx.admin.id, updatedAt: new Date() })
        .where(and(eq(businessAddons.businessId, id), eq(businessAddons.addonId, addon.id), eq(businessAddons.status, 'active')))
        .returning({ id: businessAddons.id });
      if (!row) throw notFound();
      await audit(tx, {
        actorType: 'super_admin',
        actorId: ctx.admin.id,
        actorName: ctx.admin.name,
        businessId: id,
        action: 'superadmin.addon_revoked',
        entityType: 'addon',
        entityId: addon.code,
        req,
      });
    });
    return { ok: true };
  });

  app.post('/businesses/:id/owner/resend-invite', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const b = await loadBusiness(db, id);
    const [owner] = await db
      .select()
      .from(users)
      .where(and(eq(users.businessId, id), eq(users.isOwner, true), isNull(users.deletedAt)));
    if (!owner) throw notFound();
    await sendOwnerInvite(req, db, owner, b.name);
    await audit(db, {
      actorType: 'super_admin',
      actorId: ctx.admin.id,
      actorName: ctx.admin.name,
      businessId: id,
      action: 'superadmin.owner_invite_sent',
      entityType: 'user',
      entityId: owner.id,
      req,
    });
    return { ok: true };
  });
}
