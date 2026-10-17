import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { cashClosingSchema, paginationQuerySchema, toMinor } from '@oceanx/shared';
import type { Executor } from '../../db/client';
import { cashClosings, outlets, payments, saleRefunds, sales, users } from '../../db/schema';
import { bizCtx, requireAnyPermission, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { actor, requireOutlet } from '../../lib/tenant';
import { parse } from '../../lib/validation';

const n = (v: unknown) => Number(v ?? 0);

/**
 * What one outlet took since its last closing (or since the start of today, the first time):
 * money in by payment method, and the cash that should be in the drawer =
 * float left last time + cash handed over − change given − cash refunds.
 */
export async function closingFigures(db: Executor, businessId: string, outletId: string, timezone: string, now = new Date()) {
  const [last] = await db
    .select({ periodEnd: cashClosings.periodEnd, keptFloat: cashClosings.keptFloat, number: cashClosings.number })
    .from(cashClosings)
    .where(and(eq(cashClosings.businessId, businessId), eq(cashClosings.outletId, outletId)))
    .orderBy(desc(cashClosings.number))
    .limit(1);
  let start = last?.periodEnd;
  if (!start) {
    const [r] = await db.execute<{ d: Date }>(sql`SELECT (date_trunc('day', ${now}::timestamptz AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone}) AS d`).then((x) => x.rows);
    start = new Date(r!.d);
  }
  const [byMethod, [salesRow], [refundRow]] = await Promise.all([
    db
      .select({ method: payments.method, total: sql<string>`sum(${payments.amount})::text` })
      .from(payments)
      // Money received (refunds are kept as negative payments; they are counted from the refunds below).
      .where(and(eq(payments.businessId, businessId), eq(payments.outletId, outletId), isNull(payments.voidedAt), gt(payments.amount, 0), gt(payments.paidAt, start), lte(payments.paidAt, now)))
      .groupBy(payments.method),
    db
      .select({ n: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${sales.total}),0)::text`, change: sql<string>`coalesce(sum(${sales.changeAmount}),0)::text` })
      .from(sales)
      .where(and(eq(sales.businessId, businessId), eq(sales.outletId, outletId), eq(sales.status, 'completed'), gt(sales.completedAt, start), lte(sales.completedAt, now))),
    db
      .select({ total: sql<string>`coalesce(sum(${saleRefunds.total}),0)::text` })
      .from(saleRefunds)
      .where(and(eq(saleRefunds.businessId, businessId), eq(saleRefunds.outletId, outletId), eq(saleRefunds.method, 'cash'), gt(saleRefunds.createdAt, start), lte(saleRefunds.createdAt, now))),
  ]);
  const methods = Object.fromEntries(byMethod.map((m) => [m.method, n(m.total)]));
  const openingFloat = last?.keptFloat ?? 0;
  const cashIn = methods.cash ?? 0;
  const changeGiven = n(salesRow?.change);
  const cashRefunds = n(refundRow?.total);
  return {
    number: (last?.number ?? 0) + 1,
    periodStart: start,
    periodEnd: now,
    salesCount: salesRow?.n ?? 0,
    salesTotal: n(salesRow?.total),
    byMethod: methods,
    openingFloat,
    cashIn,
    changeGiven,
    cashRefunds,
    expectedCash: openingFloat + cashIn - changeGiven - cashRefunds,
  };
}

/** End-of-day cash closing for the POS: see the day's money, count the drawer, record over / short. */
export async function cashClosingRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  /** The figures for a closing right now at the current outlet (nothing is saved). */
  app.get('/pos/closing', { preHandler: requirePermission('pos.close_day') }, async (req) => {
    const ctx = bizCtx(req);
    return closingFigures(db, ctx.businessId, requireOutlet(ctx), ctx.access.business.timezone);
  });

  /** Close: the server works out the figures again; only the counted cash and the float come from the till. */
  app.post('/pos/closing', { preHandler: requirePermission('pos.close_day') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const outletId = requireOutlet(ctx);
    const body = parse(cashClosingSchema, req.body);
    const counted = toMinor(body.countedCash);
    const kept = toMinor(body.keptFloat);
    const row = await db.transaction(async (tx) => {
      // One closing at a time per outlet.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`cash_closing:${outletId}`}))`);
      const f = await closingFigures(tx, ctx.businessId, outletId, ctx.access.business.timezone);
      const [c] = await tx
        .insert(cashClosings)
        .values({ businessId: ctx.businessId, outletId, ...f, countedCash: counted, difference: counted - f.expectedCash, keptFloat: kept, note: body.note, closedBy: ctx.user.id })
        .returning();
      await audit(tx, { ...actor(ctx), action: 'pos.day_closed', entityType: 'cash_closing', entityId: c!.id, metadata: { number: c!.number, expected: c!.expectedCash, counted, difference: c!.difference }, req });
      return c!;
    });
    reply.status(201);
    return row;
  });

  app.get('/pos/closings', { preHandler: requireAnyPermission('pos.close_day', 'reports.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(paginationQuerySchema.extend({ outletId: z.uuid().optional() }), req.query);
    const where = and(eq(cashClosings.businessId, ctx.businessId), q.outletId ? eq(cashClosings.outletId, q.outletId) : undefined);
    const rows = await db
      .select({ c: cashClosings, outletName: outlets.name, closedByName: users.name })
      .from(cashClosings)
      .leftJoin(outlets, eq(outlets.id, cashClosings.outletId))
      .leftJoin(users, eq(users.id, cashClosings.closedBy))
      .where(where)
      .orderBy(desc(cashClosings.periodEnd))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);
    const [t] = await db.select({ n: sql<number>`count(*)::int` }).from(cashClosings).where(where);
    return { items: rows.map((r) => ({ ...r.c, outletName: r.outletName, closedByName: r.closedByName })), total: t?.n ?? 0, page: q.page, pageSize: q.pageSize };
  });

  app.get('/pos/closings/:id', { preHandler: requireAnyPermission('pos.close_day', 'reports.view') }, async (req) => {
    const ctx = bizCtx(req);
    const [r] = await db
      .select({ c: cashClosings, outletName: outlets.name, closedByName: users.name })
      .from(cashClosings)
      .leftJoin(outlets, eq(outlets.id, cashClosings.outletId))
      .leftJoin(users, eq(users.id, cashClosings.closedBy))
      .where(and(eq(cashClosings.businessId, ctx.businessId), eq(cashClosings.id, idParam(req))));
    if (!r) throw notFound();
    return { ...r.c, outletName: r.outletName, closedByName: r.closedByName, business: { name: ctx.access.business.name, currency: ctx.access.business.currency } };
  });
}
