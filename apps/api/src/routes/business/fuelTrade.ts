import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { fuelCreditPaymentSchema, fuelCustomerSchema, fuelSaleSchema, fuelStockMoveSchema } from '@oceanx/shared';
import type { Executor } from '../../db/client';
import { fuelCreditPayments, fuelCustomers, fuelNozzles, fuelSales, fuelStockMoves, fuelTanks } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { actor, own } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import { fuelSetupOf } from './fuel';

const money = (n: number) => Math.round(n * 100) / 100;
const idParam = z.object({ id: z.string().uuid() });

/**
 * What is in each tank now: the last dip (the measured level), plus deliveries since, minus litres sold since.
 * A tank never dipped starts from zero and says so (`measured: false`).
 */
export async function fuelTankStock(db: Executor, businessId: string) {
  const rows = await db
    .execute<{ id: string; dip_l: string | null; dip_at: Date | null; delivered: string; sold: string }>(
      sql`
      SELECT t.id, d.litres AS dip_l, d.created_at AS dip_at,
        COALESCE((SELECT sum(m.litres) FROM fuel_stock_moves m WHERE m.tank_id = t.id AND m.kind = 'delivery' AND (d.created_at IS NULL OR m.created_at > d.created_at)), 0) AS delivered,
        COALESCE((SELECT sum(s.litres) FROM fuel_sales s WHERE s.tank_id = t.id AND s.voided_at IS NULL AND (d.created_at IS NULL OR s.created_at > d.created_at)), 0) AS sold
      FROM fuel_tanks t
      LEFT JOIN LATERAL (SELECT litres, created_at FROM fuel_stock_moves WHERE tank_id = t.id AND kind = 'dip' ORDER BY created_at DESC LIMIT 1) d ON true
      WHERE t.business_id = ${businessId} AND t.deleted_at IS NULL`,
    )
    .then((r) => r.rows);
  return new Map(
    rows.map((r) => [
      r.id,
      { stockL: money(Number(r.dip_l ?? 0) + Number(r.delivered) - Number(r.sold)), measured: r.dip_l != null, lastDipAt: r.dip_at, soldSinceDipL: Number(r.sold) },
    ]),
  );
}

/** What each credit customer owes: credit sales (not voided) minus what they paid back. */
async function owedByCustomer(db: Executor, businessId: string) {
  const rows = await db
    .execute<{ id: string; owed: string }>(
      sql`
      SELECT c.id,
        COALESCE((SELECT sum(s.total) FROM fuel_sales s WHERE s.customer_id = c.id AND s.payment = 'credit' AND s.voided_at IS NULL), 0)
        - COALESCE((SELECT sum(p.amount) FROM fuel_credit_payments p WHERE p.customer_id = c.id), 0) AS owed
      FROM fuel_customers c WHERE c.business_id = ${businessId}`,
    )
    .then((r) => r.rows);
  return new Map(rows.map((r) => [r.id, money(Number(r.owed))]));
}

/** Start of today in the shed's time zone. */
async function dayStart(db: Executor, tz: string, daysAgo = 0) {
  const [r] = await db
    .execute<{ d: Date }>(sql`SELECT ((date_trunc('day', now() AT TIME ZONE ${tz}) - make_interval(days => ${daysAgo})) AT TIME ZONE ${tz}) AS d`)
    .then((x) => x.rows);
  return new Date(r!.d);
}

const saleRow = (s: typeof fuelSales.$inferSelect, customerName?: string | null, nozzleName?: string | null) => ({
  id: s.id,
  fuel: s.fuel,
  litres: Number(s.litres),
  pricePerL: Number(s.pricePerL),
  fuelAmount: Number(s.fuelAmount),
  deliveryCharge: Number(s.deliveryCharge),
  total: Number(s.total),
  payment: s.payment,
  customerId: s.customerId,
  customerName: customerName ?? null,
  nozzleName: nozzleName ?? null,
  vehicle: s.vehicle,
  createdByName: s.createdByName,
  createdAt: s.createdAt,
  voided: !!s.voidedAt,
});

/** Theyo Fihaara day to day: the dashboard, selling at the till, tank deliveries and dips, credit customers. */
export async function fuelTradeRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  async function salesOf(businessId: string, from: Date, to?: Date, limit = 200) {
    const rows = await db
      .select({ s: fuelSales, customerName: fuelCustomers.name, nozzleName: fuelNozzles.name })
      .from(fuelSales)
      .leftJoin(fuelCustomers, eq(fuelCustomers.id, fuelSales.customerId))
      .leftJoin(fuelNozzles, eq(fuelNozzles.id, fuelSales.nozzleId))
      .where(and(eq(fuelSales.businessId, businessId), sql`${fuelSales.createdAt} >= ${from}`, to ? sql`${fuelSales.createdAt} < ${to}` : undefined))
      .orderBy(desc(fuelSales.createdAt))
      .limit(limit);
    return rows.map((r) => saleRow(r.s, r.customerName, r.nozzleName));
  }

  // ── Dashboard ──
  app.get('/fuel/dashboard', { preHandler: requirePermission('fuel.view') }, async (req) => {
    const ctx = bizCtx(req);
    const tz = ctx.access.business.timezone;
    const setup = await fuelSetupOf(db, ctx.businessId);
    const today = await dayStart(db, tz);
    const weekAgo = await dayStart(db, tz, 6);
    const [stock, owed, recent, week, todayRows] = await Promise.all([
      fuelTankStock(db, ctx.businessId),
      owedByCustomer(db, ctx.businessId),
      salesOf(ctx.businessId, today, undefined, 8),
      db
        .execute<{ day: string; total: string; litres: string }>(
          sql`
          SELECT to_char((created_at AT TIME ZONE ${tz})::date, 'YYYY-MM-DD') AS day, sum(total) AS total, sum(litres) AS litres
          FROM fuel_sales WHERE business_id = ${ctx.businessId} AND voided_at IS NULL AND created_at >= ${weekAgo}
          GROUP BY 1 ORDER BY 1`,
        )
        .then((r) => r.rows),
      db
        .execute<{ fuel: string; payment: string; n: string; litres: string; total: string }>(
          sql`
          SELECT fuel, payment, count(*) AS n, sum(litres) AS litres, sum(total) AS total
          FROM fuel_sales WHERE business_id = ${ctx.businessId} AND voided_at IS NULL AND created_at >= ${today}
          GROUP BY fuel, payment`,
        )
        .then((r) => r.rows),
    ]);
    const byPayment = { cash: 0, card: 0, transfer: 0, credit: 0 } as Record<string, number>;
    const litresByFuel = { petrol: 0, diesel: 0 } as Record<string, number>;
    let count = 0;
    let total = 0;
    for (const r of todayRows) {
      byPayment[r.payment] = money((byPayment[r.payment] ?? 0) + Number(r.total));
      litresByFuel[r.fuel] = money((litresByFuel[r.fuel] ?? 0) + Number(r.litres));
      count += Number(r.n);
      total += Number(r.total);
    }
    // Every one of the last 7 days, so the chart has no gaps.
    const days: { day: string; total: number; litres: number }[] = [];
    const found = new Map(week.map((w) => [w.day, w]));
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86_400_000 + 12 * 3_600_000);
      const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      const w = found.get(key);
      days.push({ day: key, total: money(Number(w?.total ?? 0)), litres: money(Number(w?.litres ?? 0)) });
    }
    const owedValues = [...owed.values()].filter((v) => v > 0);
    return {
      setupDone: setup.done,
      config: setup.config,
      today: { count, total: money(total), byPayment, litresByFuel },
      owed: { total: money(owedValues.reduce((a, b) => a + b, 0)), customers: owedValues.length },
      tanks: setup.tanks.map((t) => ({ ...t, ...(stock.get(t.id) ?? { stockL: 0, measured: false, lastDipAt: null, soldSinceDipL: 0 }) })),
      nozzles: setup.nozzles,
      week: days,
      recent,
    };
  });

  // ── Till ──
  app.get('/fuel/sales', { preHandler: requirePermission('fuel.view') }, async (req) => {
    const ctx = bizCtx(req);
    const { daysAgo } = parse(z.object({ daysAgo: z.coerce.number().int().min(0).max(365).default(0) }), req.query);
    const from = await dayStart(db, ctx.access.business.timezone, daysAgo);
    const to = daysAgo > 0 ? await dayStart(db, ctx.access.business.timezone, daysAgo - 1) : undefined;
    return { sales: await salesOf(ctx.businessId, from, to, 500) };
  });

  app.post('/fuel/sales', { preHandler: requirePermission('fuel.sell') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(fuelSaleSchema, req.body);
    const { config, done } = await fuelSetupOf(db, ctx.businessId);
    if (!done) throw new AppError('feature_not_enabled', 'Set up the shed first');
    const [nozzle] = await db
      .select({ n: fuelNozzles, tank: fuelTanks })
      .from(fuelNozzles)
      .innerJoin(fuelTanks, eq(fuelTanks.id, fuelNozzles.tankId))
      .where(and(own(fuelNozzles, ctx, body.nozzleId), isNull(fuelTanks.deletedAt)));
    if (!nozzle) throw new AppError('validation_failed', 'Unknown nozzle', { fields: { nozzleId: { code: 'invalid_option' } } });
    const fuel = nozzle.tank.fuel as 'petrol' | 'diesel';
    const price = config.prices[fuel];
    if (!price || !config.fuels.includes(fuel)) throw new AppError('validation_failed', 'No price for this fuel', { fields: { nozzleId: { code: 'invalid_option' } } });
    const litres = body.by === 'litres' ? money(body.value) : money(body.value / price);
    const fuelAmount = body.by === 'amount' ? money(body.value) : money(litres * price);
    if (!(litres > 0)) throw new AppError('validation_failed', 'Too small', { fields: { value: { code: 'too_small' } } });
    const dc = config.deliveryCharge;
    const deliveryCharge = body.delivery && dc.on ? money(dc.type === 'fixed' ? dc.amount : dc.amount * litres) : 0;
    const total = money(fuelAmount + deliveryCharge);

    let customerId: string | null = null;
    if (body.payment === 'credit') {
      if (!config.credit) throw new AppError('feature_not_enabled', 'Credit is off in Shed settings');
      const [c] = await db.select().from(fuelCustomers).where(own(fuelCustomers, ctx, body.customerId!));
      if (!c) throw new AppError('validation_failed', 'Unknown customer', { fields: { customerId: { code: 'invalid_option' } } });
      const owes = (await owedByCustomer(db, ctx.businessId)).get(c.id) ?? 0;
      const limit = Number(c.creditLimit);
      if (limit > 0 && owes + total > limit + 0.001) throw new AppError('credit_limit_exceeded', 'Over the credit limit', { details: { available: money(Math.max(0, limit - owes)) } });
      customerId = c.id;
    } else if (body.customerId) {
      const [c] = await db.select({ id: fuelCustomers.id }).from(fuelCustomers).where(own(fuelCustomers, ctx, body.customerId));
      customerId = c?.id ?? null;
    }

    const sale = await db.transaction(async (tx) => {
      const [s] = await tx
        .insert(fuelSales)
        .values({
          businessId: ctx.businessId,
          nozzleId: nozzle.n.id,
          tankId: nozzle.tank.id,
          fuel,
          litres,
          pricePerL: price,
          fuelAmount,
          deliveryCharge,
          total,
          payment: body.payment,
          customerId,
          vehicle: body.vehicle,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name,
        })
        .returning();
      await audit(tx, { ...actor(ctx), action: 'fuel.sale', entityType: 'fuel_sale', entityId: s!.id, metadata: { litres, total, payment: body.payment }, req });
      return s!;
    });
    reply.code(201);
    return saleRow(sale, null, nozzle.n.name);
  });

  app.post('/fuel/sales/:id/void', { preHandler: requirePermission('fuel.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const { id } = parse(idParam, req.params);
    const [s] = await db.select().from(fuelSales).where(and(eq(fuelSales.businessId, ctx.businessId), eq(fuelSales.id, id)));
    if (!s) throw new AppError('not_found', 'Sale not found');
    if (s.voidedAt) return saleRow(s);
    const [v] = await db.update(fuelSales).set({ voidedAt: new Date(), voidedBy: ctx.user.id }).where(eq(fuelSales.id, id)).returning();
    await audit(db, { ...actor(ctx), action: 'fuel.sale_voided', entityType: 'fuel_sale', entityId: id, metadata: { total: Number(s.total) }, req });
    return saleRow(v!);
  });

  // ── Tanks: deliveries and dips ──
  app.get('/fuel/tanks', { preHandler: requirePermission('fuel.view') }, async (req) => {
    const ctx = bizCtx(req);
    const setup = await fuelSetupOf(db, ctx.businessId);
    const stock = await fuelTankStock(db, ctx.businessId);
    const moves = await db
      .select()
      .from(fuelStockMoves)
      .where(eq(fuelStockMoves.businessId, ctx.businessId))
      .orderBy(desc(fuelStockMoves.createdAt))
      .limit(60);
    return {
      tanks: setup.tanks.map((t) => ({ ...t, ...(stock.get(t.id) ?? { stockL: 0, measured: false, lastDipAt: null, soldSinceDipL: 0 }) })),
      moves: moves.map((m) => ({
        id: m.id,
        tankId: m.tankId,
        kind: m.kind,
        litres: Number(m.litres),
        bookL: m.bookL == null ? null : Number(m.bookL),
        cost: m.cost == null ? null : Number(m.cost),
        supplier: m.supplier,
        note: m.note,
        createdByName: m.createdByName,
        createdAt: m.createdAt,
      })),
    };
  });

  app.post('/fuel/stock', { preHandler: requirePermission('fuel.stock') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(fuelStockMoveSchema, req.body);
    const [tank] = await db.select().from(fuelTanks).where(own(fuelTanks, ctx, body.tankId));
    if (!tank) throw new AppError('validation_failed', 'Unknown tank', { fields: { tankId: { code: 'invalid_option' } } });
    if (body.kind === 'delivery' && !(body.litres > 0)) throw new AppError('validation_failed', 'Litres required', { fields: { litres: { code: 'too_small' } } });
    if (body.litres > Number(tank.capacityL) * 1.05) throw new AppError('validation_failed', 'More than the tank holds', { fields: { litres: { code: 'too_big' } } });
    const book = (await fuelTankStock(db, ctx.businessId)).get(tank.id);
    const [m] = await db
      .insert(fuelStockMoves)
      .values({
        businessId: ctx.businessId,
        tankId: tank.id,
        kind: body.kind,
        litres: money(body.litres),
        bookL: body.kind === 'dip' && book?.measured ? book.stockL : null,
        cost: body.kind === 'delivery' ? (body.cost ?? null) : null,
        supplier: body.kind === 'delivery' ? body.supplier : '',
        note: body.note,
        createdBy: ctx.user.id,
        createdByName: ctx.user.name,
      })
      .returning();
    await audit(db, { ...actor(ctx), action: `fuel.${body.kind}`, entityType: 'fuel_tank', entityId: tank.id, metadata: { litres: body.litres }, req });
    reply.code(201);
    return { id: m!.id };
  });

  // ── Credit customers ──
  app.get('/fuel/customers', { preHandler: requirePermission('fuel.view') }, async (req) => {
    const ctx = bizCtx(req);
    const rows = await db
      .select()
      .from(fuelCustomers)
      .where(and(eq(fuelCustomers.businessId, ctx.businessId), isNull(fuelCustomers.deletedAt)))
      .orderBy(asc(fuelCustomers.name));
    const owed = await owedByCustomer(db, ctx.businessId);
    return {
      customers: rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone, creditLimit: Number(c.creditLimit), note: c.note, owed: owed.get(c.id) ?? 0 })),
    };
  });

  app.post('/fuel/customers', { preHandler: requirePermission('fuel.credit') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(fuelCustomerSchema, req.body);
    const [c] = await db.insert(fuelCustomers).values({ ...body, businessId: ctx.businessId }).returning();
    await audit(db, { ...actor(ctx), action: 'fuel.customer_created', entityType: 'fuel_customer', entityId: c!.id, req });
    reply.code(201);
    return { id: c!.id, name: c!.name, phone: c!.phone, creditLimit: Number(c!.creditLimit), note: c!.note, owed: 0 };
  });

  app.patch('/fuel/customers/:id', { preHandler: requirePermission('fuel.credit') }, async (req) => {
    const ctx = bizCtx(req);
    const { id } = parse(idParam, req.params);
    const body = parse(fuelCustomerSchema, req.body);
    const [c] = await db.update(fuelCustomers).set({ ...body, updatedAt: new Date() }).where(own(fuelCustomers, ctx, id)).returning();
    if (!c) throw new AppError('not_found', 'Customer not found');
    return { id: c.id };
  });

  app.get('/fuel/customers/:id', { preHandler: requirePermission('fuel.view') }, async (req) => {
    const ctx = bizCtx(req);
    const { id } = parse(idParam, req.params);
    const [c] = await db.select().from(fuelCustomers).where(own(fuelCustomers, ctx, id));
    if (!c) throw new AppError('not_found', 'Customer not found');
    const [sales, payments, owed] = await Promise.all([
      db
        .select({ s: fuelSales, nozzleName: fuelNozzles.name })
        .from(fuelSales)
        .leftJoin(fuelNozzles, eq(fuelNozzles.id, fuelSales.nozzleId))
        .where(and(eq(fuelSales.businessId, ctx.businessId), eq(fuelSales.customerId, id)))
        .orderBy(desc(fuelSales.createdAt))
        .limit(200),
      db.select().from(fuelCreditPayments).where(and(eq(fuelCreditPayments.businessId, ctx.businessId), eq(fuelCreditPayments.customerId, id))).orderBy(desc(fuelCreditPayments.createdAt)).limit(200),
      owedByCustomer(db, ctx.businessId),
    ]);
    return {
      customer: { id: c.id, name: c.name, phone: c.phone, creditLimit: Number(c.creditLimit), note: c.note, owed: owed.get(c.id) ?? 0 },
      sales: sales.map((r) => saleRow(r.s, c.name, r.nozzleName)),
      payments: payments.map((p) => ({ id: p.id, amount: Number(p.amount), method: p.method, note: p.note, createdByName: p.createdByName, createdAt: p.createdAt })),
    };
  });

  app.post('/fuel/customers/:id/payments', { preHandler: requirePermission('fuel.credit') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const { id } = parse(idParam, req.params);
    const body = parse(fuelCreditPaymentSchema, req.body);
    const [c] = await db.select().from(fuelCustomers).where(own(fuelCustomers, ctx, id));
    if (!c) throw new AppError('not_found', 'Customer not found');
    const owes = (await owedByCustomer(db, ctx.businessId)).get(c.id) ?? 0;
    if (body.amount > owes + 0.001) throw new AppError('payment_exceeds_balance', 'More than owed', { details: { balance: owes } });
    const [p] = await db
      .insert(fuelCreditPayments)
      .values({ businessId: ctx.businessId, customerId: c.id, amount: money(body.amount), method: body.method, note: body.note, createdBy: ctx.user.id, createdByName: ctx.user.name })
      .returning();
    await audit(db, { ...actor(ctx), action: 'fuel.credit_payment', entityType: 'fuel_customer', entityId: c.id, metadata: { amount: body.amount }, req });
    reply.code(201);
    return { id: p!.id, owed: money(owes - body.amount) };
  });
}
