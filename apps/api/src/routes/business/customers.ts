import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { customerSchema, loyaltyAdjustSchema, paginationQuerySchema, toMinor } from '@oceanx/shared';
import { customers, invoices, loyaltyTransactions, payments, quotations, sales } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { actor, businessToday, own } from '../../lib/tenant';
import { loadBusinessSettings } from '../../services/settings';
import { parse } from '../../lib/validation';
import { lockCustomer, outstandingFor } from '../../services/ops/customers';

const statementQuery = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() });
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

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

  /**
   * Statement of account for a period: opening balance, chronological debits (credit sales, invoices)
   * and credits (payments) with running balance, closing balance, and the open (unpaid) items with
   * their age. Dates are calendar days in the business time zone. Used on screen and for the PDF.
   */
  app.get('/customers/:id/statement', { preHandler: requirePermission('credit.view') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const q = parse(statementQuery, req.query);
    if (q.from && q.to && q.from > q.to) throw new AppError('validation_failed', 'Invalid range', { fields: { to: { code: 'invalid' } } });
    const [c] = await db.select().from(customers).where(own(customers, ctx, id));
    if (!c) throw notFound();
    const tz = ctx.access.business.timezone;
    const ledger = sql`
      SELECT completed_at AS date, 'credit_sale' AS kind, number AS ref, (total - paid_amount + change_amount) AS debit, 0 AS credit
        FROM sales WHERE business_id = ${ctx.businessId} AND customer_id = ${id} AND status = 'completed' AND (total - paid_amount + change_amount) > 0
      UNION ALL
      SELECT COALESCE(issued_at, created_at), 'invoice', number, total, 0
        FROM invoices WHERE business_id = ${ctx.businessId} AND customer_id = ${id} AND status IN ('issued','partially_paid','paid')
      UNION ALL
      SELECT paid_at, kind, reference, 0, amount
        FROM payments WHERE business_id = ${ctx.businessId} AND customer_id = ${id} AND voided_at IS NULL AND kind IN ('credit_payment','invoice')`;
    const day = sql`(l.date AT TIME ZONE ${tz})::date`;
    const [opening] = q.from
      ? (await db.execute<{ bal: string }>(sql`SELECT COALESCE(SUM(l.debit - l.credit), 0)::bigint AS bal FROM (${ledger}) l WHERE ${day} < ${q.from}::date`)).rows
      : [{ bal: '0' }];
    const rows = await db.execute<{ date: string; kind: string; ref: string | null; debit: string; credit: string }>(sql`
      SELECT l.* FROM (${ledger}) l
      WHERE ${q.from ? sql`${day} >= ${q.from}::date` : sql`TRUE`} AND ${q.to ? sql`${day} <= ${q.to}::date` : sql`TRUE`}
      ORDER BY l.date ASC LIMIT 5000`);
    const openingBalance = Number(opening?.bal ?? 0);
    let balance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;
    const entries = rows.rows.map((r) => {
      const debit = Number(r.debit);
      const credit = Number(r.credit);
      totalDebit += debit;
      totalCredit += credit;
      balance += debit - credit;
      return { date: r.date, kind: r.kind, reference: r.ref, debit, credit, balance };
    });
    const today = businessToday(tz);
    const openItems = (
      await db.execute<{ kind: string; ref: string | null; date: string; due_date: string | null; total: string; due: string }>(sql`
        SELECT 'credit_sale' AS kind, number AS ref, (completed_at AT TIME ZONE ${tz})::date::text AS date, NULL AS due_date, total, balance_due AS due
          FROM sales WHERE business_id = ${ctx.businessId} AND customer_id = ${id} AND status = 'completed' AND balance_due > 0
        UNION ALL
        SELECT 'invoice', number, invoice_date::text, due_date::text, total, balance_due
          FROM invoices WHERE business_id = ${ctx.businessId} AND customer_id = ${id} AND status IN ('issued','partially_paid') AND balance_due > 0
        ORDER BY 3 ASC`)
    ).rows.map((r) => {
      const dueOn = r.due_date ?? (c.creditDays != null ? addDays(r.date, c.creditDays) : r.date);
      return { kind: r.kind, reference: r.ref, date: r.date, dueDate: dueOn, total: Number(r.total), due: Number(r.due), daysOverdue: Math.max(0, daysBetween(dueOn, today)) };
    });
    const settings = await loadBusinessSettings(db, ctx.businessId);
    const b = ctx.access.business;
    return {
      customer: { id: c.id, name: c.name, company: c.company, phone: c.phone, email: c.email, address: c.address, taxNumber: c.taxNumber, creditLimit: c.creditLimit, creditDays: c.creditDays },
      period: { from: q.from ?? null, to: q.to ?? today },
      openingBalance,
      entries,
      totals: { debit: totalDebit, credit: totalCredit },
      closingBalance: balance,
      openItems,
      outstanding: openItems.reduce((a, i) => a + i.due, 0),
      overdue: openItems.filter((i) => i.daysOverdue > 0).reduce((a, i) => a + i.due, 0),
      // Kept for older clients.
      balance,
      business: { name: b.name, address: b.address, phone: b.phone, email: b.email, hasLogo: !!b.logoPath },
      settings: { regional: settings.regional, tax: { taxName: settings.tax.taxName, taxNumber: settings.tax.taxNumber } },
      documentLanguage: settings.regional.documentLanguage,
      generatedAt: new Date().toISOString(),
    };
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
