import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, gte, isNull, like, lte } from 'drizzle-orm';
import { z } from 'zod';
import { paginationQuerySchema, preferencesSchema } from '@oceanx/shared';
import { activityLogs, outlets, roles, userOutlets, userSessions, users } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { AppError } from '../../lib/errors';
import { parse } from '../../lib/validation';

const activityQuerySchema = paginationQuerySchema.extend({
  action: z
    .string()
    .trim()
    .max(64)
    .regex(/^[a-z_.]*$/)
    .optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export async function miscRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  app.patch('/me/preferences', { config: { sessionOnly: true } }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(preferencesSchema, req.body);
    const { language, ...prefs } = body;
    const [current] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, ctx.user.id));
    await db
      .update(users)
      .set({ ...(language ? { language } : {}), preferences: { ...(current?.preferences ?? {}), ...prefs }, updatedAt: new Date() })
      .where(and(eq(users.id, ctx.user.id), eq(users.businessId, ctx.businessId)));
    return { ok: true };
  });

  /** Switch working outlet. The outlet is validated against the user's access — never trusted from the client. */
  app.post('/me/outlet', async (req) => {
    const ctx = bizCtx(req);
    const { outletId } = parse(z.object({ outletId: z.uuid() }), req.body);
    const [outlet] = await db
      .select({ id: outlets.id })
      .from(outlets)
      .where(and(eq(outlets.id, outletId), eq(outlets.businessId, ctx.businessId), eq(outlets.isActive, true)));
    if (!outlet) throw new AppError('not_found');
    const assigned = await db.select({ id: userOutlets.outletId }).from(userOutlets).where(eq(userOutlets.userId, ctx.user.id));
    if (assigned.length && !assigned.some((a) => a.id === outletId)) throw new AppError('forbidden', 'Outlet not assigned to you');
    await db.update(userSessions).set({ currentOutletId: outletId }).where(eq(userSessions.id, ctx.sessionId));
    return { ok: true };
  });

  /**
   * Dashboard data. Each widget is only computed when the user's permissions allow it.
   * Phase 2 adds sales/order widgets to this same endpoint.
   */
  app.get('/dashboard', { preHandler: requirePermission('dashboard.view') }, async (req) => {
    const ctx = bizCtx(req);
    const widgets: Record<string, unknown> = {};
    const sub = ctx.access.subscription;
    widgets.subscription = sub
      ? {
          planName: sub.planName,
          status: sub.effectiveStatus,
          currentPeriodEnd: sub.currentPeriodEnd,
          daysLeft: Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86_400_000)),
        }
      : null;
    if (ctx.permissions.has('users.view')) {
      const [u] = await db
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.businessId, ctx.businessId), eq(users.isActive, true), isNull(users.deletedAt)));
      widgets.team = { activeUsers: Number(u?.n ?? 0), limit: ctx.access.limits.max_users ?? null };
    }
    if (ctx.permissions.has('roles.view')) {
      const [r] = await db.select({ n: count() }).from(roles).where(eq(roles.businessId, ctx.businessId));
      widgets.roles = { count: Number(r?.n ?? 0) };
    }
    if (ctx.permissions.has('audit.view')) {
      widgets.recentActivity = await db
        .select({ id: activityLogs.id, action: activityLogs.action, actorName: activityLogs.actorName, createdAt: activityLogs.createdAt })
        .from(activityLogs)
        .where(eq(activityLogs.businessId, ctx.businessId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(8);
    }
    widgets.modules = [...ctx.access.modules];
    widgets.addons = [...ctx.access.addons];
    return { widgets };
  });

  app.get('/activity-logs', { preHandler: requirePermission('audit.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(activityQuerySchema, req.query);
    const where = and(
      eq(activityLogs.businessId, ctx.businessId),
      q.action ? like(activityLogs.action, `${q.action}%`) : undefined,
      q.from ? gte(activityLogs.createdAt, new Date(`${q.from}T00:00:00Z`)) : undefined,
      q.to ? lte(activityLogs.createdAt, new Date(`${q.to}T23:59:59.999Z`)) : undefined,
    );
    const [items, [total]] = await Promise.all([
      db
        .select({
          id: activityLogs.id,
          action: activityLogs.action,
          actorType: activityLogs.actorType,
          actorName: activityLogs.actorName,
          entityType: activityLogs.entityType,
          entityId: activityLogs.entityId,
          metadata: activityLogs.metadata,
          ip: activityLogs.ip,
          createdAt: activityLogs.createdAt,
        })
        .from(activityLogs)
        .where(where)
        .orderBy(desc(activityLogs.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(activityLogs).where(where),
    ]);
    return { items, page: q.page, pageSize: q.pageSize, total: Number(total?.n ?? 0) };
  });
}
