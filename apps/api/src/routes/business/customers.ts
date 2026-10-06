import type { FastifyInstance } from 'fastify';
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { customerSchema, loyaltyAdjustSchema, paginationQuerySchema, toMinor } from '@oceanx/shared';
import { customers, invoices, loyaltyTransactions, payments, quotations, sales } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { actor, own } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import { lockCustomer, outstandingFor } from '../../services/ops/customers';

export async function customerRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  app.get('/customers', { preHandler: requirePermission('customers.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(paginationQuerySchema, req.query);
    const where = and(
      eq(customers.businessId, ctx.businessId),
      isNull(customers.deletedAt),
      q.q ? or(ilike(customers.name, `%${q.q}%`), ilike(customers.phone, `%${q.q}%`), ilike(customers.email, `%${q.q}%`), ilike(customers.company, `%${q.q}%`)) : undefined,
    );
    const [items, [total]] = await Promise.all([
      db
        .select()
        .from(customers)
        .where(where)
        .orderBy(asc(customers.name))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(customers).where(where),
    ]);
    const due = await outstandingFor(
      db,
      ctx.businessId,
      items.map((c) => c.id),
    );
    return {
      items: items.map((c) => {
        const d = due.get(c.id)!;
        return { ...c, outstanding: d.sales + d.invoices, overdue: d.overdue };
      }),
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total?.n ?? 0),
    };
  });

  app.post('/customers', { preHandler: requirePermission('customers.create') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(customerSchema, req.body);
    if ((body.creditLimit !== null || body.creditDays !== null) && !ctx.permissions.has('credit.manage')) {
      body.creditLimit = null;
      body.creditDays = null;
    }
    const [c] = await db
      .insert(customers)
      .values({ ...body, creditLimit: body.creditLimit === null ? null : toMinor(body.creditLimit), businessId: ctx.businessId })
      .returning();
    await audit(db, { ...actor(ctx), action: 'customer.created', entityType: 'customer', entityId: c!.id, req });
    reply.status(201);
    return c;
  });

  app.put('/customers/:id', { preHandler: requirePermission('customers.edit') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(customerSchema, req.body);
    const [before] = await db.select().from(customers).where(own(customers, ctx, id));
    if (!before) throw notFound();
    // Credit limits/terms are financial controls: only credit managers may change them.
    const canCredit = ctx.permissions.has('credit.manage');
    const [c] = await db
      .update(customers)
      .set({
        ...body,
        creditLimit: canCredit ? (body.creditLimit === null ? null : toMinor(body.creditLimit)) : before.creditLimit,
        creditDays: canCredit ? body.creditDays : before.creditDays,
        updatedAt: new Date(),
      })
      .where(own(customers, ctx, id))
      .returning();
    await audit(db, { ...actor(ctx), action: 'customer.updated', entityType: 'customer', entityId: id, req });
    return c;
  });

  app.delete('/customers/:id', { preHandler: requirePermission('customers.delete') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const due = (await outstandingFor(db, ctx.businessId, [id])).get(id)!;
    if (due.sales + due.invoices > 0) throw new AppError('conflict', 'Customer has an outstanding balance');
    const [c] = await db.update(customers).set({ deletedAt: new Date() }).where(own(customers, ctx, id)).returning({ id: customers.id });
    if (!c) throw notFound();
    await audit(db, { ...actor(ctx), action: 'customer.deleted', entityType: 'customer', entityId: id, req });
    return { ok: true };
  });

  /** Customer profile: totals, outstanding, recent sales/quotations/invoices/payments. */
  app.get('/customers/:id', { preHandler: requirePermission('customers.view') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [c] = await db.select().from(customers).where(own(customers, ctx, id));
    if (!c) throw notFound();
    const canQuote = ctx.permissions.has('quotations.view');
    const canInvoice = ctx.permissions.has('invoices.view');
    const [stats, recentSales, recentQuotes, recentInvoices, recentPayments, due] = await Promise.all([
      db
        .select({ n: count(), spent: sql<string>`COALESCE(SUM(${sales.total}), 0)`, last: sql<string | null>`MAX(${sales.completedAt})` })
        .from(sales)
        .where(and(eq(sales.businessId, ctx.businessId), eq(sales.customerId, id), eq(sales.status, 'completed'))),
      db
        .select({ id: sales.id, number: sales.number, total: sales.total, balanceDue: sales.balanceDue, completedAt: sales.completedAt, status: sales.status })
        .from(sales)
        .where(and(eq(sales.businessId, ctx.businessId), eq(sales.customerId, id), sql`${sales.status} <> 'open'`))
        .orderBy(desc(sales.createdAt))
        .limit(10),
      canQuote
        ? db
            .select({ id: quotations.id, number: quotations.number, total: quotations.total, status: quotations.status, date: quotations.quotationDate })
            .from(quotations)
            .where(and(eq(quotations.businessId, ctx.businessId), eq(quotations.customerId, id)))
            .orderBy(desc(quotations.createdAt))
            .limit(10)
        : Promise.resolve(null),
      canInvoice
        ? db
            .select({ id: invoices.id, number: invoices.number, total: invoices.total, balanceDue: invoices.balanceDue, status: invoices.status, date: invoices.invoiceDate, dueDate: invoices.dueDate })
            .from(invoices)
            .where(and(eq(invoices.businessId, ctx.businessId), eq(invoices.customerId, id)))
            .orderBy(desc(invoices.createdAt))
            .limit(10)
        : Promise.resolve(null),
      db
        .select({ id: payments.id, kind: payments.kind, method: payments.method, amount: payments.amount, paidAt: payments.paidAt, reference: payments.reference })
        .from(payments)
        .where(and(eq(payments.businessId, ctx.businessId), eq(payments.customerId, id), isNull(payments.voidedAt)))
        .orderBy(desc(payments.paidAt))
        .limit(10),
      outstandingFor(db, ctx.businessId, [id]),
    ]);
    const d = due.get(id)!;
    const outstanding = d.sales + d.invoices;
    return {
      customer: c,
      stats: { salesCount: Number(stats[0]?.n ?? 0), totalSpent: Number(stats[0]?.spent ?? 0), lastPurchaseAt: stats[0]?.last ?? null },
      outstanding,
      outstandingSales: d.sales,
      outstandingInvoices: d.invoices,
      overdue: d.overdue,
      availableCredit: c.creditLimit === null ? null : Math.max(0, c.creditLimit - outstanding),
      sales: recentSales,
      quotations: recentQuotes,
      invoices: recentInvoices,
      payments: recentPayments,
    };
  });

  /** Statement: chronological debits (credit sales, invoices) and credits (payments) with running balance. */
  app.get('/customers/:id/statement', { preHandler: requirePermission('credit.view') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [c] = await db.select({ id: customers.id, name: customers.name }).from(customers).where(own(customers, ctx, id));
    if (!c) throw notFound();
    const rows = await db.execute<{ date: string; kind: string; ref: string | null; debit: string; credit: string }>(sql`
      SELECT * FROM (
        SELECT completed_at AS date, 'credit_sale' AS kind, number AS ref, (total - paid_amount + change_amount) AS debit, 0 AS credit
          FROM sales WHERE business_id = ${ctx.businessId} AND customer_id = ${id} AND status = 'completed' AND (total - paid_amount + change_amount) > 0
        UNION ALL
        SELECT COALESCE(issued_at, created_at), 'invoice', number, total, 0
          FROM invoices WHERE business_id = ${ctx.businessId} AND customer_id = ${id} AND status IN ('issued','partially_paid','paid')
        UNION ALL
        SELECT paid_at, kind, reference, 0, amount
          FROM payments WHERE business_id = ${ctx.businessId} AND customer_id = ${id} AND voided_at IS NULL AND kind IN ('credit_payment','invoice')
      ) s ORDER BY date ASC LIMIT 1000`);
    let balance = 0;
    const entries = rows.rows.map((r) => {
      balance += Number(r.debit) - Number(r.credit);
      return { date: r.date, kind: r.kind, reference: r.ref, debit: Number(r.debit), credit: Number(r.credit), balance };
    });
    return { customer: c, entries, balance };
  });

  // ---------------------------------------------------------------- loyalty (add-on)
  app.get('/customers/:id/loyalty', { preHandler: requirePermission('loyalty.view') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [c] = await db.select({ points: customers.loyaltyPoints }).from(customers).where(own(customers, ctx, id));
    if (!c) throw notFound();
    const history = await db
      .select()
      .from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.businessId, ctx.businessId), eq(loyaltyTransactions.customerId, id)))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(50);
    return { points: c.points, history };
  });

  app.post('/customers/:id/loyalty', { preHandler: requirePermission('loyalty.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(loyaltyAdjustSchema, req.body);
    const balance = await db.transaction(async (tx) => {
      const c = await lockCustomer(tx, ctx.businessId, id);
      if (!c) throw notFound();
      const next = c.loyaltyPoints + body.points;
      if (next < 0) throw new AppError('points_insufficient');
      await tx.update(customers).set({ loyaltyPoints: next }).where(own(customers, ctx, id));
      await tx.insert(loyaltyTransactions).values({ businessId: ctx.businessId, customerId: id, points: body.points, balanceAfter: next, reason: body.reason, createdBy: ctx.user.id });
      await audit(tx, { ...actor(ctx), action: 'loyalty.adjusted', entityType: 'customer', entityId: id, metadata: { points: body.points }, req });
      return next;
    });
    return { points: balance };
  });
}
