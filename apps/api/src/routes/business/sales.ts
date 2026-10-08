import type { FastifyInstance } from 'fastify';
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { completeOrderSchema, kitchenStatusSchema, paginationQuerySchema, posOrderSchema, recordPaymentSchema, tableSchema, voidSchema } from '@oceanx/shared';
import { businesses, customers, diningTables, invoices, kitchenOrders, payments, saleItems, sales, users } from '../../db/schema';
import { assertPermission, bizCtx, requireAnyPermission, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { actor, own, requireOutlet } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import { loadBusinessSettings } from '../../services/settings';
import { sendCreditSaleMessage } from '../../services/viber/creditMessage';
import { completeSale, createOrder, priceOrder, receiveCreditPayment, updateOpenOrder, voidSale } from '../../services/ops/sales';
import { documentBranding } from '../../services/branding';

const salesQuery = paginationQuerySchema.extend({
  status: z.enum(['open', 'completed', 'void']).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  customerId: z.uuid().optional(),
  credit: z.enum(['true']).optional(),
});

const createOrderBody = posOrderSchema.extend({ payments: completeOrderSchema.shape.payments.optional() });

export async function saleRoutes(app: FastifyInstance) {
  /**
   * Optional Viber "Total: …/-" message for Credit (Pay Later) sales. Runs after the transaction has
   * committed and is not awaited: it can never block, slow down or fail the checkout.
   */
  const afterSaleCommitted = (sale: { id: string; status: string; balanceDue: number } | undefined) => {
    if (!sale || sale.status !== 'completed' || sale.balanceDue <= 0) return;
    setImmediate(() => void sendCreditSaleMessage(app.deps.db, app.deps.viber, sale.id, app.log));
  };
  const { db } = app.deps;

  // ---------------------------------------------------------------- POS
  /** Preview totals with server rules (the UI shows exactly what will be charged). */
  app.post('/pos/quote', { preHandler: requirePermission('pos.access') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(posOrderSchema, req.body);
    const priced = await priceOrder(db, ctx, body);
    return {
      lines: priced.lines.map((l) => ({ productId: l.productId, name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, tax: l.tax, total: l.total, options: l.options })),
      subtotal: priced.calc.subtotal,
      discount: priced.calc.discount,
      serviceCharge: priced.calc.serviceCharge,
      tax: priced.calc.tax,
      deliveryFee: priced.deliveryFee,
      total: priced.total,
    };
  });

  app.post('/pos/orders', { preHandler: requirePermission('pos.access', 'sales.create') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(createOrderBody, req.body);
    if (body.orderType === 'delivery') assertPermission(ctx, 'delivery.manage');
    const { payments: pays, ...order } = body;
    const sale = await createOrder(db, ctx, order, pays ?? null, req);
    afterSaleCommitted(sale);
    reply.status(201);
    return sale;
  });

  app.put('/pos/orders/:id', { preHandler: requirePermission('pos.access', 'sales.create') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(posOrderSchema, req.body);
    return updateOpenOrder(db, ctx, idParam(req), body, req);
  });

  app.post('/pos/orders/:id/pay', { preHandler: requirePermission('pos.access', 'sales.create') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(completeOrderSchema, req.body);
    const sale = await db.transaction((tx) => completeSale(tx, ctx, idParam(req), body.payments, req));
    afterSaleCommitted(sale);
    return sale;
  });

  app.get('/pos/open-orders', { preHandler: requirePermission('pos.access') }, async (req) => {
    const ctx = bizCtx(req);
    const outletId = requireOutlet(ctx);
    const rows = await db
      .select({ s: sales, tableName: diningTables.name, customerName: customers.name })
      .from(sales)
      .leftJoin(diningTables, eq(diningTables.id, sales.tableId))
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .where(and(eq(sales.businessId, ctx.businessId), eq(sales.outletId, outletId), eq(sales.status, 'open')))
      .orderBy(asc(sales.createdAt))
      .limit(200);
    return { items: rows.map((r) => ({ ...r.s, tableName: r.tableName, customerName: r.customerName })) };
  });

  // ---------------------------------------------------------------- sales
  app.get('/sales', { preHandler: requirePermission('sales.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(salesQuery, req.query);
    const where = and(
      eq(sales.businessId, ctx.businessId),
      q.status ? eq(sales.status, q.status) : undefined,
      q.from ? gte(sales.createdAt, new Date(`${q.from}T00:00:00Z`)) : undefined,
      q.to ? lte(sales.createdAt, new Date(`${q.to}T23:59:59.999Z`)) : undefined,
      q.customerId ? eq(sales.customerId, q.customerId) : undefined,
      q.credit ? sql`${sales.balanceDue} > 0` : undefined,
      q.q ? or(ilike(sales.number, `%${q.q}%`), ilike(customers.name, `%${q.q}%`)) : undefined,
    );
    const [items, [total]] = await Promise.all([
      db
        .select({ s: sales, customerName: customers.name, cashierName: users.name, tableName: diningTables.name })
        .from(sales)
        .leftJoin(customers, eq(customers.id, sales.customerId))
        .leftJoin(users, eq(users.id, sales.cashierId))
        .leftJoin(diningTables, eq(diningTables.id, sales.tableId))
        .where(where)
        .orderBy(desc(sales.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db
        .select({ n: count() })
        .from(sales)
        .leftJoin(customers, eq(customers.id, sales.customerId))
        .where(where),
    ]);
    return {
      items: items.map((r) => ({ ...r.s, customerName: r.customerName, cashierName: r.cashierName, tableName: r.tableName })),
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total?.n ?? 0),
    };
  });

  /** Sale detail + everything needed to print the receipt (in the document language). */
  app.get('/sales/:id', { preHandler: requireAnyPermission('sales.view', 'pos.access') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [row] = await db
      .select({ s: sales, customer: customers, cashierName: users.name, tableName: diningTables.name })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .leftJoin(users, eq(users.id, sales.cashierId))
      .leftJoin(diningTables, eq(diningTables.id, sales.tableId))
      .where(own(sales, ctx, id));
    if (!row) throw notFound();
    const [items, pays, settings] = await Promise.all([
      db.select().from(saleItems).where(eq(saleItems.saleId, id)).orderBy(asc(saleItems.nameSnapshot)),
      db.select().from(payments).where(and(eq(payments.saleId, id), eq(payments.businessId, ctx.businessId))).orderBy(asc(payments.paidAt)),
      loadBusinessSettings(db, ctx.businessId),
    ]);
    const b = ctx.access.business;
    return {
      sale: { ...row.s, cashierName: row.cashierName, tableName: row.tableName },
      customer: row.customer,
      items,
      payments: pays,
      business: { name: b.name, address: b.address, phone: b.phone, email: b.email, hasLogo: !!b.logoPath, currency: b.currency },
      settings: { receipt: settings.receipt, regional: settings.regional, tax: { taxName: settings.tax.taxName, taxNumber: settings.tax.taxNumber } },
      documentLanguage: settings.receipt.language ?? settings.regional.documentLanguage,
    };
  });

  app.post('/sales/:id/void', { preHandler: requirePermission('sales.void') }, async (req) => {
    const ctx = bizCtx(req);
    const { reason } = parse(voidSchema, req.body);
    return voidSale(db, ctx, idParam(req), reason, req);
  });

  // ---------------------------------------------------------------- payments & credit
  app.get('/payments', { preHandler: requirePermission('payments.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(paginationQuerySchema.extend({ from: z.iso.date().optional(), to: z.iso.date().optional(), method: z.string().max(20).optional() }), req.query);
    const where = and(
      eq(payments.businessId, ctx.businessId),
      isNull(payments.voidedAt),
      q.from ? gte(payments.paidAt, new Date(`${q.from}T00:00:00Z`)) : undefined,
      q.to ? lte(payments.paidAt, new Date(`${q.to}T23:59:59.999Z`)) : undefined,
      q.method ? eq(payments.method, q.method) : undefined,
    );
    const [items, [total]] = await Promise.all([
      db
        .select({ p: payments, customerName: customers.name, receivedByName: users.name, saleNumber: sales.number })
        .from(payments)
        .leftJoin(customers, eq(customers.id, payments.customerId))
        .leftJoin(users, eq(users.id, payments.receivedBy))
        .leftJoin(sales, eq(sales.id, payments.saleId))
        .where(where)
        .orderBy(desc(payments.paidAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(payments).where(where),
    ]);
    return { items: items.map((r) => ({ ...r.p, customerName: r.customerName, receivedByName: r.receivedByName, saleNumber: r.saleNumber })), page: q.page, pageSize: q.pageSize, total: Number(total?.n ?? 0) };
  });

  app.post('/customers/:id/credit-payments', { preHandler: requirePermission('credit.payment') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(recordPaymentSchema, req.body);
    return receiveCreditPayment(db, ctx, idParam(req), body, req);
  });

  /** Receipt for one due payment (possibly spread over several bills). */
  app.get<{ Params: { groupId: string } }>('/credit-payments/:groupId', { preHandler: requireAnyPermission('credit.view', 'credit.payment') }, async (req) => {
    const ctx = bizCtx(req);
    const groupId = z.uuid().safeParse(req.params.groupId);
    if (!groupId.success) throw notFound();
    const rows = await db
      .select({ p: payments, saleNumber: sales.number, invoiceNumber: invoices.number, receivedByName: users.name })
      .from(payments)
      .leftJoin(sales, eq(sales.id, payments.saleId))
      .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
      .leftJoin(users, eq(users.id, payments.receivedBy))
      .where(and(eq(payments.businessId, ctx.businessId), eq(payments.groupId, groupId.data), isNull(payments.voidedAt)))
      .orderBy(asc(payments.createdAt));
    const first = rows[0]?.p;
    if (!first?.customerId) throw notFound();
    const [c] = await db.select({ name: customers.name, phone: customers.phone }).from(customers).where(own(customers, ctx, first.customerId));
    const [b] = await db.select().from(businesses).where(eq(businesses.id, ctx.businessId));
    const settings = await loadBusinessSettings(db, ctx.businessId);
    return {
      id: groupId.data,
      customer: c ?? { name: '', phone: '' },
      paidAt: first.paidAt,
      method: first.method,
      reference: first.reference,
      amount: rows.reduce((a, r) => a + r.p.amount, 0),
      balanceAfter: first.balanceAfter ?? 0,
      receivedByName: rows[0]!.receivedByName ?? '',
      lines: rows.map((r) => ({ kind: r.p.invoiceId ? 'invoice' : 'sale', number: r.invoiceNumber ?? r.saleNumber ?? '', amount: r.p.amount })),
      branding: await documentBranding(db, ctx, first.receivedBy),
      business: { name: b!.name, address: b!.address, phone: b!.phone, email: b!.email, hasLogo: !!b!.logoPath },
      settings: { regional: settings.regional, tax: { taxName: settings.tax.taxName, taxNumber: settings.tax.taxNumber } },
      documentLanguage: settings.regional.documentLanguage,
    };
  });

  // ---------------------------------------------------------------- tables
  app.get('/tables', { preHandler: requireAnyPermission('tables.view', 'pos.access') }, async (req) => {
    const ctx = bizCtx(req);
    const outletId = requireOutlet(ctx);
    const rows = await db
      .select({
        t: diningTables,
        openOrders: sql<number>`(SELECT count(*)::int FROM sales s WHERE s.table_id = "dining_tables"."id" AND s.status = 'open')`,
        openTotal: sql<number>`(SELECT COALESCE(sum(total),0)::bigint FROM sales s WHERE s.table_id = "dining_tables"."id" AND s.status = 'open')`,
      })
      .from(diningTables)
      .where(and(eq(diningTables.businessId, ctx.businessId), eq(diningTables.outletId, outletId)))
      .orderBy(asc(diningTables.area), asc(diningTables.name));
    return {
      items: rows.map((r) => ({ ...r.t, openOrders: Number(r.openOrders), openTotal: Number(r.openTotal), status: !r.t.isActive ? 'inactive' : Number(r.openOrders) > 0 ? 'occupied' : 'available' })),
    };
  });

  app.post('/tables', { preHandler: requirePermission('tables.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(tableSchema, req.body);
    const [t] = await db
      .insert(diningTables)
      .values({ ...body, businessId: ctx.businessId, outletId: requireOutlet(ctx) })
      .returning();
    await audit(db, { ...actor(ctx), action: 'table.created', entityType: 'table', entityId: t!.id, req });
    reply.status(201);
    return t;
  });

  app.patch('/tables/:id', { preHandler: requirePermission('tables.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(tableSchema.partial(), req.body);
    const [t] = await db
      .update(diningTables)
      .set({ ...body, updatedAt: new Date() })
      .where(own(diningTables, ctx, idParam(req)))
      .returning();
    if (!t) throw notFound();
    return t;
  });

  app.delete('/tables/:id', { preHandler: requirePermission('tables.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [open] = await db
      .select({ n: count() })
      .from(sales)
      .where(and(eq(sales.tableId, id), eq(sales.status, 'open')));
    if (Number(open?.n ?? 0) > 0) throw new AppError('conflict', 'Table has open orders');
    const [t] = await db.delete(diningTables).where(own(diningTables, ctx, id)).returning({ id: diningTables.id });
    if (!t) throw notFound();
    return { ok: true };
  });

  // ---------------------------------------------------------------- kitchen display
  app.get('/kitchen/orders', { preHandler: requirePermission('kitchen.view') }, async (req) => {
    const ctx = bizCtx(req);
    const outletId = requireOutlet(ctx);
    const q = parse(z.object({ station: z.string().max(40).optional(), includeCompleted: z.enum(['true', 'false']).optional() }), req.query);
    const statuses = q.includeCompleted === 'true' ? ['new', 'preparing', 'ready', 'completed'] : ['new', 'preparing', 'ready'];
    const rows = await db
      .select()
      .from(kitchenOrders)
      .where(
        and(
          eq(kitchenOrders.businessId, ctx.businessId),
          eq(kitchenOrders.outletId, outletId),
          inArray(kitchenOrders.status, statuses),
          q.station !== undefined && ctx.access.addons.has('advanced_kitchen') ? eq(kitchenOrders.station, q.station) : undefined,
          q.includeCompleted === 'true' ? gte(kitchenOrders.createdAt, new Date(Date.now() - 12 * 3_600_000)) : undefined,
        ),
      )
      .orderBy(desc(kitchenOrders.priority), asc(kitchenOrders.createdAt))
      .limit(200);
    return { items: rows, serverTime: new Date().toISOString() };
  });

  app.patch('/kitchen/orders/:id', { preHandler: requirePermission('kitchen.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const { status } = parse(kitchenStatusSchema, req.body);
    const now = new Date();
    const [k] = await db
      .update(kitchenOrders)
      .set({
        status,
        ...(status === 'preparing' ? { startedAt: now } : {}),
        ...(status === 'ready' ? { readyAt: now } : {}),
        ...(status === 'completed' ? { completedAt: now } : {}),
      })
      .where(own(kitchenOrders, ctx, idParam(req)))
      .returning();
    if (!k) throw notFound();
    return k;
  });

  app.patch('/kitchen/orders/:id/priority', { preHandler: requirePermission('kitchen.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const { priority } = parse(z.object({ priority: z.number().int().min(0).max(10) }), req.body);
    const [k] = await db.update(kitchenOrders).set({ priority }).where(own(kitchenOrders, ctx, idParam(req))).returning();
    if (!k) throw notFound();
    return k;
  });
}
