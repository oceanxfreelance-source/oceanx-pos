import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, gte, ilike, isNull, like, lte, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  addonSchema,
  createSuperAdminSchema,
  languageUpdateSchema,
  paginationQuerySchema,
  planSchema,
  platformSettingsSchema,
  PRODUCTS,
} from '@oceanx/shared';
import {
  activityLogs,
  addons,
  businessAddons,
  businesses,
  platformLanguages,
  platformSettings,
  plans,
  subscriptions,
  superAdmins,
  superAdminSessions,
  users,
} from '../../db/schema';
import { saCtx } from '../../guards/superadmin';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { parse } from '../../lib/validation';
import { getPlatformSettings } from '../../services/platformSettings';
import { issueSuperAdminToken } from '../../services/tokens';

const num = (v: unknown) => Number(v ?? 0);

export async function platformRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  // ------------------------------------------------------------ dashboard
  app.get('/dashboard', async () => {
    const [byType, byStatus, subs, mrr, addonMrr, newRegs, userStats, addonUsage, recent, series] = await Promise.all([
      db
        .select({ type: businesses.businessType, n: count() })
        .from(businesses)
        .where(and(isNull(businesses.deletedAt), eq(businesses.product, 'pos')))
        .groupBy(businesses.businessType),
      db
        .select({ status: businesses.status, n: count() })
        .from(businesses)
        .where(and(isNull(businesses.deletedAt), eq(businesses.product, 'pos')))
        .groupBy(businesses.status),
      db.execute<{ trialing: string; active: string; expired: string }>(sql`
        SELECT
          count(*) FILTER (WHERE status = 'trialing' AND current_period_end >= now()) AS trialing,
          count(*) FILTER (WHERE status IN ('active','past_due') AND current_period_end >= now()) AS active,
          count(*) FILTER (WHERE status IN ('expired','cancelled') OR current_period_end < now()) AS expired
        FROM subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE product = 'pos')`),
      db.execute<{ currency: string; total: string }>(sql`
        SELECT p.currency, sum(p.price_monthly)::text AS total
        FROM subscriptions s JOIN plans p ON p.id = s.plan_id JOIN businesses b ON b.id = s.business_id
        WHERE s.status IN ('active','past_due') AND s.current_period_end >= now() AND b.status = 'active' AND b.product = 'pos'
        GROUP BY p.currency`),
      db.execute<{ currency: string; total: string }>(sql`
        SELECT a.currency, sum(a.price_monthly)::text AS total
        FROM business_addons ba JOIN addons a ON a.id = ba.addon_id JOIN businesses b ON b.id = ba.business_id
        WHERE ba.status = 'active' AND a.price_monthly IS NOT NULL AND b.status = 'active'
        GROUP BY a.currency`),
      db
        .select({ n: count() })
        .from(businesses)
        .where(and(isNull(businesses.deletedAt), eq(businesses.product, 'pos'), gte(businesses.createdAt, sql`now() - interval '30 days'`))),
      db.execute<{ total: string; active30: string }>(sql`
        SELECT count(*) FILTER (WHERE deleted_at IS NULL) AS total,
               count(*) FILTER (WHERE deleted_at IS NULL AND last_login_at >= now() - interval '30 days') AS active30
        FROM users`),
      db
        .select({ code: addons.code, name: addons.name, n: count(businessAddons.id) })
        .from(addons)
        .leftJoin(businessAddons, and(eq(businessAddons.addonId, addons.id), eq(businessAddons.status, 'active')))
        .groupBy(addons.code, addons.name)
        .orderBy(desc(count(businessAddons.id))),
      db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(10),
      db.execute<{ day: string; n: string }>(sql`
        SELECT to_char(d::date, 'YYYY-MM-DD') AS day, count(b.id) AS n
        FROM generate_series(current_date - 29, current_date, interval '1 day') d
        LEFT JOIN businesses b ON b.created_at::date = d::date AND b.deleted_at IS NULL
        GROUP BY d ORDER BY d`),
    ]);
    const typeCounts = Object.fromEntries(byType.map((r) => [r.type, num(r.n)]));
    const statusCounts = Object.fromEntries(byStatus.map((r) => [r.status, num(r.n)]));
    const revenue: Record<string, number> = {};
    for (const r of [...mrr.rows, ...addonMrr.rows]) revenue[r.currency] = (revenue[r.currency] ?? 0) + Number(r.total);
    return {
      businesses: {
        total: Object.values(typeCounts).reduce((a, b) => a + b, 0),
        byType: typeCounts,
        byStatus: statusCounts,
        newLast30Days: num(newRegs[0]?.n),
        registrationsSeries: series.rows.map((r) => ({ day: r.day, count: num(r.n) })),
      },
      subscriptions: {
        trialing: num(subs.rows[0]?.trialing),
        active: num(subs.rows[0]?.active),
        expired: num(subs.rows[0]?.expired),
      },
      mrr: revenue,
      users: { total: num(userStats.rows[0]?.total), activeLast30Days: num(userStats.rows[0]?.active30) },
      addonUsage: addonUsage.map((a) => ({ code: a.code, name: a.name, businesses: num(a.n) })),
      recentActivity: recent,
    };
  });

  // ------------------------------------------------------------ plans
  app.get('/plans', async (req) => {
    const q = parse(z.object({ product: z.enum(PRODUCTS).optional() }), req.query);
    const rows = await db
      .select({ plan: plans, n: count(subscriptions.id) })
      .from(plans)
      .leftJoin(subscriptions, eq(subscriptions.planId, plans.id))
      .where(q.product ? eq(plans.product, q.product) : undefined)
      .groupBy(plans.id)
      .orderBy(plans.sortOrder, plans.name);
    return { items: rows.map((r) => ({ ...r.plan, subscriptionCount: num(r.n) })) };
  });

  app.post('/plans', async (req, reply) => {
    const ctx = saCtx(req);
    const body = parse(planSchema, req.body);
    const [plan] = await db
      .insert(plans)
      .values({ ...body, priceMonthly: body.priceMonthly.toFixed(2), limits: body.limits as Record<string, number | null> })
      .returning();
    await audit(db, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: 'superadmin.plan_created', entityType: 'plan', entityId: plan!.id, metadata: { code: body.code }, req });
    reply.status(201);
    return plan;
  });

  app.put('/plans/:id', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const body = parse(planSchema, req.body);
    const [plan] = await db
      .update(plans)
      .set({ ...body, priceMonthly: body.priceMonthly.toFixed(2), limits: body.limits as Record<string, number | null>, updatedAt: new Date() })
      .where(eq(plans.id, id))
      .returning();
    if (!plan) throw notFound();
    await audit(db, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: 'superadmin.plan_updated', entityType: 'plan', entityId: id, metadata: { code: body.code }, req });
    return plan;
  });

  // ------------------------------------------------------------ add-on catalog
  app.get('/addons', async () => {
    const rows = await db
      .select({ addon: addons, n: count(businessAddons.id) })
      .from(addons)
      .leftJoin(businessAddons, and(eq(businessAddons.addonId, addons.id), eq(businessAddons.status, 'active')))
      .groupBy(addons.id)
      .orderBy(addons.name);
    return { items: rows.map((r) => ({ ...r.addon, activeBusinesses: num(r.n) })) };
  });

  app.post('/addons', async (req, reply) => {
    const ctx = saCtx(req);
    const body = parse(addonSchema, req.body);
    const [addon] = await db
      .insert(addons)
      .values({ ...body, priceMonthly: body.priceMonthly === null ? null : body.priceMonthly.toFixed(2) })
      .returning();
    await audit(db, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: 'superadmin.addon_created', entityType: 'addon', entityId: body.code, req });
    reply.status(201);
    return addon;
  });

  app.put('/addons/:id', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const body = parse(addonSchema, req.body);
    const [existing] = await db.select().from(addons).where(eq(addons.id, id));
    if (!existing) throw notFound();
    // The code links the catalog entry to its implementation; it is immutable once created.
    const [addon] = await db
      .update(addons)
      .set({ ...body, code: existing.code, priceMonthly: body.priceMonthly === null ? null : body.priceMonthly.toFixed(2), updatedAt: new Date() })
      .where(eq(addons.id, id))
      .returning();
    await audit(db, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: 'superadmin.addon_updated', entityType: 'addon', entityId: existing.code, req });
    return addon;
  });

  // ------------------------------------------------------------ subscriptions overview
  app.get('/subscriptions', async (req) => {
    const q = parse(paginationQuerySchema.extend({ status: z.enum(['trialing', 'active', 'expired']).optional() }), req.query);
    const statusFilter =
      q.status === 'expired'
        ? sql`(${subscriptions.status} IN ('expired','cancelled') OR ${subscriptions.currentPeriodEnd} < now())`
        : q.status
          ? sql`(${subscriptions.status} = ${q.status} AND ${subscriptions.currentPeriodEnd} >= now())`
          : undefined;
    const where = and(isNull(businesses.deletedAt), statusFilter, q.q ? ilike(businesses.name, `%${q.q}%`) : undefined);
    const [items, [total]] = await Promise.all([
      db
        .select({
          id: subscriptions.id,
          businessId: businesses.id,
          businessName: businesses.name,
          businessStatus: businesses.status,
          planName: plans.name,
          planCode: plans.code,
          priceMonthly: plans.priceMonthly,
          currency: plans.currency,
          status: subscriptions.status,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          startsAt: subscriptions.startsAt,
        })
        .from(subscriptions)
        .innerJoin(businesses, eq(businesses.id, subscriptions.businessId))
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .where(where)
        .orderBy(subscriptions.currentPeriodEnd)
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db
        .select({ n: count() })
        .from(subscriptions)
        .innerJoin(businesses, eq(businesses.id, subscriptions.businessId))
        .where(where),
    ]);
    return { items, page: q.page, pageSize: q.pageSize, total: num(total?.n) };
  });

  // ------------------------------------------------------------ languages
  app.get('/languages', async () => ({ items: await db.select().from(platformLanguages).orderBy(platformLanguages.sortOrder) }));

  app.patch<{ Params: { code: string } }>('/languages/:code', async (req) => {
    const ctx = saCtx(req);
    const body = parse(languageUpdateSchema, req.body);
    await db.transaction(async (tx) => {
      const [lang] = await tx.select().from(platformLanguages).where(eq(platformLanguages.code, req.params.code));
      if (!lang) throw notFound();
      const willBeDefault = body.isDefault ?? lang.isDefault;
      const willBeEnabled = body.isEnabled ?? lang.isEnabled;
      if (willBeDefault && !willBeEnabled) throw new AppError('validation_failed', 'The default language must be enabled', { fields: { isEnabled: { code: 'default_language_required' } } });
      if (lang.isDefault && body.isDefault === false) throw new AppError('validation_failed', 'Choose another default first', { fields: { isDefault: { code: 'default_language_required' } } });
      if (body.isDefault) await tx.update(platformLanguages).set({ isDefault: false }).where(ne(platformLanguages.code, lang.code));
      await tx.update(platformLanguages).set(body).where(eq(platformLanguages.code, lang.code));
      await audit(tx, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: 'superadmin.settings_changed', entityType: 'language', entityId: lang.code, metadata: body, req });
    });
    return { ok: true };
  });

  // ------------------------------------------------------------ platform settings
  app.get('/settings', async () => getPlatformSettings(db));

  app.patch('/settings', async (req) => {
    const ctx = saCtx(req);
    const body = parse(platformSettingsSchema, req.body);
    // Each product's sign-up plan must be one of that product's plans.
    for (const [field, product] of [
      ['defaultPlanCode', 'pos'],
      ['gravityPlanCode', 'gravity'],
    ] as const) {
      const code = body[field];
      if (!code) continue;
      const [p] = await db.select({ id: plans.id }).from(plans).where(and(eq(plans.code, code), eq(plans.product, product)));
      if (!p) throw new AppError('validation_failed', 'Unknown plan', { fields: { [field]: { code: 'invalid_option' } } });
    }
    await db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(body)) {
        await tx
          .insert(platformSettings)
          .values({ key, value, updatedBy: ctx.admin.id })
          .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date(), updatedBy: ctx.admin.id } });
      }
      await audit(tx, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: 'superadmin.settings_changed', entityType: 'platform_settings', metadata: body, req });
    });
    return getPlatformSettings(db);
  });

  // ------------------------------------------------------------ activity logs
  app.get('/activity-logs', async (req) => {
    const q = parse(
      paginationQuerySchema.extend({
        actorType: z.enum(['super_admin', 'user', 'system']).optional(),
        businessId: z.uuid().optional(),
        action: z
          .string()
          .trim()
          .max(64)
          .regex(/^[a-z_.]*$/)
          .optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
      }),
      req.query,
    );
    const where = and(
      q.actorType ? eq(activityLogs.actorType, q.actorType) : undefined,
      q.businessId ? eq(activityLogs.businessId, q.businessId) : undefined,
      q.action ? like(activityLogs.action, `${q.action}%`) : undefined,
      q.from ? gte(activityLogs.createdAt, new Date(`${q.from}T00:00:00Z`)) : undefined,
      q.to ? lte(activityLogs.createdAt, new Date(`${q.to}T23:59:59.999Z`)) : undefined,
    );
    const [items, [total]] = await Promise.all([
      db
        .select({ log: activityLogs, businessName: businesses.name })
        .from(activityLogs)
        .leftJoin(businesses, eq(businesses.id, activityLogs.businessId))
        .where(where)
        .orderBy(desc(activityLogs.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(activityLogs).where(where),
    ]);
    return { items: items.map((i) => ({ ...i.log, businessName: i.businessName })), page: q.page, pageSize: q.pageSize, total: num(total?.n) };
  });

  // ------------------------------------------------------------ platform users
  app.get('/users/business', async (req) => {
    const q = parse(paginationQuerySchema, req.query);
    const where = and(isNull(users.deletedAt), q.q ? or(ilike(users.name, `%${q.q}%`), ilike(users.email, `%${q.q}%`)) : undefined);
    const [items, [total]] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          isOwner: users.isOwner,
          isActive: users.isActive,
          lastLoginAt: users.lastLoginAt,
          businessId: businesses.id,
          businessName: businesses.name,
        })
        .from(users)
        .innerJoin(businesses, eq(businesses.id, users.businessId))
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(users).where(where),
    ]);
    return { items, page: q.page, pageSize: q.pageSize, total: num(total?.n) };
  });

  app.get('/users/admins', async () => ({
    items: await db
      .select({
        id: superAdmins.id,
        name: superAdmins.name,
        email: superAdmins.email,
        isActive: superAdmins.isActive,
        totpEnabled: superAdmins.totpEnabled,
        lastLoginAt: superAdmins.lastLoginAt,
        createdAt: superAdmins.createdAt,
        hasPassword: sql<boolean>`${superAdmins.passwordHash} IS NOT NULL`,
      })
      .from(superAdmins)
      .orderBy(superAdmins.createdAt),
  }));

  app.post('/users/admins', async (req, reply) => {
    const ctx = saCtx(req);
    const body = parse(createSuperAdminSchema, req.body);
    const { mailer, config } = req.server.deps;
    const created = await db.transaction(async (tx) => {
      const [a] = await tx.insert(superAdmins).values({ name: body.name, email: body.email }).returning({ id: superAdmins.id });
      const token = await issueSuperAdminToken(tx, a!.id, 'invite');
      await mailer.send({
        to: body.email,
        subject: 'Super Admin invitation',
        text: `You have been invited as a platform Super Admin.\nSet your password (valid for 48 hours):\n${config.APP_URL}/superadmin/reset-password?token=${token}&invite=1\n`,
      });
      await audit(tx, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: 'superadmin.admin_invited', entityType: 'super_admin', entityId: a!.id, metadata: { email: body.email }, req });
      return a!;
    });
    reply.status(201);
    return created;
  });

  app.patch('/users/admins/:id', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body);
    if (id === ctx.admin.id) throw new AppError('cannot_modify_self', 'You cannot change your own status');
    await db.transaction(async (tx) => {
      if (!isActive) {
        const [active] = await tx.select({ n: count() }).from(superAdmins).where(and(eq(superAdmins.isActive, true), ne(superAdmins.id, id)));
        if (num(active?.n) < 1) throw new AppError('last_super_admin');
      }
      const [row] = await tx.update(superAdmins).set({ isActive, updatedAt: new Date() }).where(eq(superAdmins.id, id)).returning({ id: superAdmins.id });
      if (!row) throw notFound();
      if (!isActive) await tx.update(superAdminSessions).set({ revokedAt: new Date() }).where(and(eq(superAdminSessions.superAdminId, id), isNull(superAdminSessions.revokedAt)));
      await audit(tx, { actorType: 'super_admin', actorId: ctx.admin.id, actorName: ctx.admin.name, action: isActive ? 'superadmin.admin_activated' : 'superadmin.admin_deactivated', entityType: 'super_admin', entityId: id, req });
    });
    return { ok: true };
  });
}
