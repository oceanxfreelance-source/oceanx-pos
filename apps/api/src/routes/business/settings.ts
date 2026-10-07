import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import {
  businessProfileSchema,
  outletSchema,
  SETTINGS_SECTION_PERMISSIONS,
  SETTINGS_SECTIONS,
  settingsSectionSchemas,
  type SettingsSection,
} from '@oceanx/shared';
import { addons, businessAddons, businesses, messageLog, outlets } from '../../db/schema';
import { assertPermission, bizCtx, requireAnyPermission, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { IMAGE_TYPES } from '../../lib/storage';
import { parse } from '../../lib/validation';
import { actor } from '../../lib/tenant';
import { withinLimit } from '../../services/access';
import { loadBusinessSettings, saveSettingsSection } from '../../services/settings';

const LOGO_MAX_BYTES = 1_048_576;

export async function settingsRoutes(app: FastifyInstance) {
  const { db, storage } = app.deps;


  const viewAny = requireAnyPermission(...new Set(Object.values(SETTINGS_SECTION_PERMISSIONS).map((p) => p.view)));

  app.get('/settings', { preHandler: viewAny }, async (req) => {
    const ctx = bizCtx(req);
    const all = await loadBusinessSettings(db, ctx.businessId);
    const sections: Partial<typeof all> = {};
    const editable: string[] = [];
    for (const s of SETTINGS_SECTIONS) {
      const perm = SETTINGS_SECTION_PERMISSIONS[s];
      if (ctx.permissions.has(perm.view) || ctx.permissions.has(perm.manage)) (sections as Record<string, unknown>)[s] = all[s];
      if (ctx.permissions.has(perm.manage)) editable.push(s);
    }
    const b = ctx.access.business;
    const canProfile = ctx.permissions.has('settings.view');
    return {
      profile: canProfile
        ? { name: b.name, businessType: b.businessType, email: b.email, phone: b.phone, address: b.address, hasLogo: !!b.logoPath }
        : null,
      profileEditable: ctx.permissions.has('settings.manage'),
      sections,
      editable,
    };
  });

  app.patch('/settings/profile', { preHandler: requirePermission('settings.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(businessProfileSchema, req.body);
    await db.update(businesses).set({ ...body, updatedAt: new Date() }).where(eq(businesses.id, ctx.businessId));
    await audit(db, {
      actorType: 'user',
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      businessId: ctx.businessId,
      action: 'settings.updated',
      entityType: 'settings',
      entityId: 'profile',
      metadata: { fields: Object.keys(body) },
      req,
    });
    return { ok: true };
  });

  app.patch<{ Params: { section: string } }>('/settings/:section', async (req) => {
    const ctx = bizCtx(req);
    const section = req.params.section as SettingsSection;
    if (!SETTINGS_SECTIONS.includes(section)) throw notFound();
    assertPermission(ctx, SETTINGS_SECTION_PERMISSIONS[section].manage);
    const value = parse(settingsSectionSchemas[section], req.body);
    await db.transaction(async (tx) => {
      await saveSettingsSection(tx, ctx.businessId, section, value as never, ctx.user.id);
      if (section === 'regional') {
        const v = value as { currency: string; timezone: string };
        await tx.update(businesses).set({ currency: v.currency, timezone: v.timezone, updatedAt: new Date() }).where(eq(businesses.id, ctx.businessId));
      }
      await audit(tx, {
        actorType: 'user',
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        businessId: ctx.businessId,
        action: 'settings.updated',
        entityType: 'settings',
        entityId: section,
        req,
      });
    });
    return { ok: true, [section]: value };
  });

  app.put('/settings/logo', { preHandler: requirePermission('settings.manage'), bodyLimit: LOGO_MAX_BYTES }, async (req) => {
    const ctx = bizCtx(req);
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new AppError('validation_failed', 'Image required', { fields: { file: { code: 'invalid_image' } } });
    }
    const saved = await storage.saveBusinessImage(ctx.businessId, 'logo', req.body);
    const old = ctx.access.business.logoPath;
    await db.update(businesses).set({ logoPath: saved.rel, updatedAt: new Date() }).where(eq(businesses.id, ctx.businessId));
    if (old) await storage.remove(old);
    await audit(db, { actorType: 'user', actorId: ctx.user.id, actorName: ctx.user.name, businessId: ctx.businessId, action: 'settings.logo_updated', req });
    return { ok: true };
  });

  // Logo is served only to authenticated users of the SAME business (path resolved from their own business row).
  app.get('/settings/logo', async (req, reply) => {
    const ctx = bizCtx(req);
    const rel = ctx.access.business.logoPath;
    if (!rel) throw notFound();
    const ext = rel.split('.').pop();
    const type = (Object.entries(IMAGE_TYPES).find(([, d]) => d.ext === ext)?.[0] ?? 'application/octet-stream') as string;
    reply.header('content-type', type).header('cache-control', 'private, max-age=300').header('x-content-type-options', 'nosniff');
    return reply.send(await storage.read(rel));
  });

  // ------------------------------------------------------------ outlets (multi-outlet add-on)
  app.get('/outlets', { preHandler: requirePermission('outlets.view') }, async (req) => {
    const ctx = bizCtx(req);
    const items = await db.select().from(outlets).where(eq(outlets.businessId, ctx.businessId)).orderBy(outlets.createdAt);
    return { items, limit: ctx.access.limits.max_outlets ?? null };
  });

  app.post('/outlets', { preHandler: requirePermission('outlets.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(outletSchema, req.body);
    const created = await db.transaction(async (tx) => {
      const [n] = await tx.select({ n: count() }).from(outlets).where(and(eq(outlets.businessId, ctx.businessId), eq(outlets.isActive, true)));
      if (!withinLimit(ctx.access.limits, 'max_outlets', Number(n?.n ?? 0))) throw new AppError('plan_limit_reached', 'Outlet limit reached', { details: { limit: 'max_outlets' } });
      const [o] = await tx.insert(outlets).values({ ...body, businessId: ctx.businessId }).returning();
      await audit(tx, { actorType: 'user', actorId: ctx.user.id, actorName: ctx.user.name, businessId: ctx.businessId, action: 'outlet.created', entityType: 'outlet', entityId: o!.id, req });
      return o;
    });
    reply.status(201);
    return created;
  });

  app.patch('/outlets/:id', { preHandler: requirePermission('outlets.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(outletSchema.partial(), req.body);
    const [existing] = await db.select().from(outlets).where(and(eq(outlets.id, id), eq(outlets.businessId, ctx.businessId)));
    if (!existing) throw notFound();
    if (body.isActive === false && existing.isDefault) throw new AppError('invalid_status_transition', 'The default outlet cannot be deactivated');
    if (body.isActive === true && !existing.isActive) {
      const [n] = await db
        .select({ n: count() })
        .from(outlets)
        .where(and(eq(outlets.businessId, ctx.businessId), eq(outlets.isActive, true), ne(outlets.id, id)));
      if (!withinLimit(ctx.access.limits, 'max_outlets', Number(n?.n ?? 0))) throw new AppError('plan_limit_reached', 'Outlet limit reached');
    }
    await db.update(outlets).set({ ...body, updatedAt: new Date() }).where(and(eq(outlets.id, id), eq(outlets.businessId, ctx.businessId)));
    await audit(db, { actorType: 'user', actorId: ctx.user.id, actorName: ctx.user.name, businessId: ctx.businessId, action: 'outlet.updated', entityType: 'outlet', entityId: id, req });
    return { ok: true };
  });

  // ------------------------------------------------------------ add-ons visible to the business
  app.get('/addons', { preHandler: requirePermission('addons.view') }, async (req) => {
    const ctx = bizCtx(req);
    const rows = await db
      .select({
        code: addons.code,
        name: addons.name,
        description: addons.description,
        category: addons.category,
        grantStatus: businessAddons.status,
        grantedAt: businessAddons.grantedAt,
        expiresAt: businessAddons.expiresAt,
      })
      .from(addons)
      .leftJoin(businessAddons, and(eq(businessAddons.addonId, addons.id), eq(businessAddons.businessId, ctx.businessId)))
      .where(eq(addons.isActive, true))
      .orderBy(addons.name);
    return { items: rows.map((r) => ({ ...r, enabled: ctx.access.addons.has(r.code) })) };
  });

  // ================================================================ Viber Credit messaging (optional feature)
  const viberStatus = async (businessId: string) => {
    const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId));
    const recent = await db
      .select({ id: messageLog.id, recipient: messageLog.recipient, body: messageLog.body, status: messageLog.status, error: messageLog.error, createdAt: messageLog.createdAt })
      .from(messageLog)
      .where(and(eq(messageLog.businessId, businessId), eq(messageLog.channel, 'viber')))
      .orderBy(desc(messageLog.createdAt))
      .limit(20);
    return {
      /** superadmin_viber_credit_enabled */
      available: b!.superadminViberCreditEnabled,
      /** manager_viber_credit_enabled */
      enabled: b!.managerViberCreditEnabled,
      active: b!.superadminViberCreditEnabled && b!.managerViberCreditEnabled,
      requestedAt: b!.viberCreditRequestedAt,
      countryCode: b!.viberCountryCode,
      // log/memory providers only record messages; real delivery needs a configured Viber gateway.
      providerConfigured: !!app.deps.viber && !['log', 'memory'].includes(app.deps.viber.name),
      recent,
    };
  };

  app.get('/viber-credit', { preHandler: requirePermission('settings.view') }, async (req) => viberStatus(bizCtx(req).businessId));

  app.put('/viber-credit', { preHandler: requirePermission('settings.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(
      z.object({
        enabled: z.boolean(),
        countryCode: z
          .string()
          .trim()
          .regex(/^\d{0,4}$/)
          .default(''),
      }),
      req.body,
    );
    const [b] = await db.select({ available: businesses.superadminViberCreditEnabled }).from(businesses).where(eq(businesses.id, ctx.businessId));
    // The manager can only switch it on after the platform has enabled it for this business.
    if (body.enabled && !b?.available) throw new AppError('feature_not_enabled', 'Viber Credit is not enabled for this business');
    await db.update(businesses).set({ managerViberCreditEnabled: body.enabled, viberCountryCode: body.countryCode, updatedAt: new Date() }).where(eq(businesses.id, ctx.businessId));
    await audit(db, { ...actor(ctx), action: body.enabled ? 'viber_credit.turned_on' : 'viber_credit.turned_off', entityType: 'business', entityId: ctx.businessId, req });
    return viberStatus(ctx.businessId);
  });

  /** A business asks the platform to enable the feature (Super Admin sees the request on the business). */
  app.post('/viber-credit/request', { preHandler: requirePermission('settings.manage') }, async (req) => {
    const ctx = bizCtx(req);
    await db
      .update(businesses)
      .set({ viberCreditRequestedAt: new Date() })
      .where(and(eq(businesses.id, ctx.businessId), isNull(businesses.viberCreditRequestedAt)));
    await audit(db, { ...actor(ctx), action: 'viber_credit.requested', entityType: 'business', entityId: ctx.businessId, req });
    return viberStatus(ctx.businessId);
  });
}
