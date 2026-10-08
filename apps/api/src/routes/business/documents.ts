import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  calculateTotals,
  invoiceSchema,
  paginationQuerySchema,
  quotationSchema,
  recordPaymentSchema,
  toMinor,
  voidSchema,
  type TaxConfig,
} from '@oceanx/shared';
import type { Executor } from '../../db/client';
import { customers, invoiceItems, invoices, payments, quotationItems, quotations, users } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { actor, businessToday, own } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import { notifyPermission } from '../../services/notifications';
import { allocateDocumentNumber } from '../../services/sequences';
import { loadBusinessSettings } from '../../services/settings';
import type { BusinessContext } from '../../types';
import { documentBranding } from '../../services/branding';

type DocItemsInput = z.output<typeof quotationSchema>['items'];

/** Server-side document totals; items keep name/price snapshots so later product changes never alter a document. */
function priceDocument(items: DocItemsInput, discount: number, tax: TaxConfig) {
  const calc = calculateTotals(
    items.map((i) => ({ quantity: i.quantity, unitPrice: toMinor(i.unitPrice), discount: toMinor(i.discount), taxRate: i.taxRate })),
    tax,
    toMinor(discount),
  );
  const rows = items.map((i, idx) => ({
    position: idx,
    productId: i.productId,
    itemNameSnapshot: i.name,
    description: i.description,
    quantity: i.quantity,
    unit: i.unit,
    unitPrice: toMinor(i.unitPrice),
    discount: calc.lines[idx]!.discount,
    taxRate: i.taxRate,
    tax: calc.lines[idx]!.tax,
    total: calc.lines[idx]!.total,
  }));
  return {
    rows,
    totals: { subtotal: calc.subtotal, discount: calc.discount, orderDiscount: toMinor(discount), serviceCharge: calc.serviceCharge, tax: calc.tax, total: calc.total },
  };
}

async function assertCustomer(db: Executor, ctx: BusinessContext, customerId: string) {
  const [c] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.businessId, ctx.businessId), eq(customers.id, customerId), isNull(customers.deletedAt)));
  if (!c) throw new AppError('validation_failed', 'Unknown customer', { fields: { customerId: { code: 'invalid_option' } } });
}

async function resolveSalesperson(db: Executor, ctx: BusinessContext, id: string | null): Promise<string> {
  if (!id) return ctx.user.id;
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.businessId, ctx.businessId), eq(users.id, id), isNull(users.deletedAt)));
  if (!u) throw new AppError('validation_failed', 'Unknown salesperson', { fields: { salespersonId: { code: 'invalid_option' } } });
  return u.id;
}

/** Status shown to users: drafts/sent past their date are expired; issued invoices past due are overdue. */
export function effectiveQuotationStatus(q: { status: string; validUntil: string }, today: string) {
  return (q.status === 'draft' || q.status === 'sent') && q.validUntil < today ? 'expired' : q.status;
}
export function effectiveInvoiceStatus(i: { status: string; dueDate: string; balanceDue: number }, today: string) {
  return (i.status === 'issued' || i.status === 'partially_paid') && i.balanceDue > 0 && i.dueDate < today ? 'overdue' : i.status;
}

const listQuery = paginationQuerySchema.extend({
  status: z.string().max(20).optional(),
  customerId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

async function documentContext(db: Executor, ctx: BusinessContext, kind: 'invoice' | 'quotation', language: string | null) {
  const settings = await loadBusinessSettings(db, ctx.businessId);
  const b = ctx.access.business;
  const docSettings = kind === 'invoice' ? settings.invoice : settings.quotation;
  return {
    business: { name: b.name, businessType: b.businessType, address: b.address, phone: b.phone, email: b.email, hasLogo: !!b.logoPath },
    settings: { regional: settings.regional, tax: { taxName: settings.tax.taxName, taxNumber: settings.tax.taxNumber }, footer: docSettings.footer },
    documentLanguage: language ?? docSettings.language ?? settings.regional.documentLanguage,
  };
}

async function sendDocumentEmail(req: FastifyRequest, to: string, subject: string, text: string) {
  await req.server.deps.mailer.send({ to, subject, text });
}

export async function documentRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const today = (ctx: BusinessContext) => businessToday(ctx.access.business.timezone);

  // ================================================================ QUOTATIONS
  app.get('/quotations', { preHandler: requirePermission('quotations.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(listQuery, req.query);
    const t = today(ctx);
    const statusFilter =
      q.status === 'expired'
        ? sql`(${quotations.status} IN ('draft','sent') AND ${quotations.validUntil} < ${t})`
        : q.status
          ? eq(quotations.status, q.status)
          : undefined;
    const where = and(
      eq(quotations.businessId, ctx.businessId),
      statusFilter,
      q.customerId ? eq(quotations.customerId, q.customerId) : undefined,
      q.from ? gte(quotations.quotationDate, q.from) : undefined,
      q.to ? lte(quotations.quotationDate, q.to) : undefined,
      q.q ? or(ilike(quotations.number, `%${q.q}%`), ilike(customers.name, `%${q.q}%`)) : undefined,
    );
    const [items, [total]] = await Promise.all([
      db
        .select({ q: quotations, customerName: customers.name, salespersonName: users.name })
        .from(quotations)
        .innerJoin(customers, eq(customers.id, quotations.customerId))
        .leftJoin(users, eq(users.id, quotations.salespersonId))
        .where(where)
        .orderBy(desc(quotations.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db
        .select({ n: count() })
        .from(quotations)
        .innerJoin(customers, eq(customers.id, quotations.customerId))
        .where(where),
    ]);
    return {
      items: items.map((r) => ({ ...r.q, status: effectiveQuotationStatus(r.q, t), customerName: r.customerName, salespersonName: r.salespersonName })),
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total?.n ?? 0),
    };
  });

  app.get('/quotations/:id', { preHandler: requirePermission('quotations.view') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [row] = await db
      .select({ q: quotations, customer: customers, salespersonName: users.name })
      .from(quotations)
      .innerJoin(customers, eq(customers.id, quotations.customerId))
      .leftJoin(users, eq(users.id, quotations.salespersonId))
      .where(own(quotations, ctx, id));
    if (!row) throw notFound();
    const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id)).orderBy(asc(quotationItems.position));
    const [inv] = await db.select({ id: invoices.id, number: invoices.number }).from(invoices).where(and(eq(invoices.businessId, ctx.businessId), eq(invoices.sourceQuotationId, id)));
    return {
      quotation: { ...row.q, status: effectiveQuotationStatus(row.q, today(ctx)), salespersonName: row.salespersonName },
      customer: row.customer,
      items,
      invoice: inv ?? null,
      branding: await documentBranding(db, ctx, row.q.createdBy),
      ...(await documentContext(db, ctx, 'quotation', row.q.language)),
    };
  });

  app.post('/quotations', { preHandler: requirePermission('quotations.create') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(quotationSchema, req.body);
    if (body.validUntil < body.quotationDate) throw new AppError('validation_failed', 'Invalid dates', { fields: { validUntil: { code: 'invalid' } } });
    const created = await db.transaction(async (tx) => {
      await assertCustomer(tx, ctx, body.customerId);
      const salespersonId = await resolveSalesperson(tx, ctx, body.salespersonId);
      const settings = await loadBusinessSettings(tx, ctx.businessId);
      const { rows, totals } = priceDocument(body.items, body.discount, settings.tax);
      const { number } = await allocateDocumentNumber(tx, { businessId: ctx.businessId, docType: 'quotation', numbering: settings.quotation.numbering, date: new Date(`${body.quotationDate}T12:00:00Z`) });
      const [q] = await tx
        .insert(quotations)
        .values({
          businessId: ctx.businessId,
          outletId: ctx.outletId,
          number,
          customerId: body.customerId,
          quotationDate: body.quotationDate,
          validUntil: body.validUntil,
          salespersonId,
          language: body.language,
          notes: body.notes,
          terms: body.terms,
          currency: ctx.access.business.currency,
          taxConfig: settings.tax,
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
          ...totals,
        })
        .returning();
      await tx.insert(quotationItems).values(rows.map((r) => ({ ...r, businessId: ctx.businessId, quotationId: q!.id })));
      await audit(tx, { ...actor(ctx), action: 'quotation.created', entityType: 'quotation', entityId: q!.id, metadata: { number, total: totals.total }, req });
      await notifyPermission(tx, ctx.businessId, 'quotations.view', 'notify.quotation_created', { number }, `/quotations/${q!.id}`);
      return q!;
    });
    reply.status(201);
    return created;
  });

  app.put('/quotations/:id', { preHandler: requirePermission('quotations.edit') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(quotationSchema, req.body);
    return db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotations).where(own(quotations, ctx, id)).for('update');
      if (!q) throw notFound();
      if (q.status !== 'draft' && q.status !== 'sent') throw new AppError('document_locked', 'Only draft or sent quotations can be edited');
      await assertCustomer(tx, ctx, body.customerId);
      const salespersonId = await resolveSalesperson(tx, ctx, body.salespersonId ?? q.salespersonId);
      const settings = await loadBusinessSettings(tx, ctx.businessId);
      const { rows, totals } = priceDocument(body.items, body.discount, settings.tax);
      await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));
      await tx.insert(quotationItems).values(rows.map((r) => ({ ...r, businessId: ctx.businessId, quotationId: id })));
      const [u] = await tx
        .update(quotations)
        .set({
          customerId: body.customerId,
          quotationDate: body.quotationDate,
          validUntil: body.validUntil,
          salespersonId,
          language: body.language,
          notes: body.notes,
          terms: body.terms,
          taxConfig: settings.tax,
          updatedBy: ctx.user.id,
          updatedAt: new Date(),
          ...totals,
        })
        .where(eq(quotations.id, id))
        .returning();
      await audit(tx, { ...actor(ctx), action: 'quotation.updated', entityType: 'quotation', entityId: id, metadata: { total: totals.total }, req });
      return u;
    });
  });

  const Q_TRANSITIONS: Record<string, { from: string[]; to: string; perm: string }> = {
    send: { from: ['draft', 'sent'], to: 'sent', perm: 'quotations.send' },
    accept: { from: ['draft', 'sent'], to: 'accepted', perm: 'quotations.edit' },
    reject: { from: ['draft', 'sent'], to: 'rejected', perm: 'quotations.edit' },
    cancel: { from: ['draft', 'sent', 'accepted'], to: 'cancelled', perm: 'quotations.edit' },
    expire: { from: ['draft', 'sent'], to: 'expired', perm: 'quotations.edit' },
  };
  for (const [verb, t] of Object.entries(Q_TRANSITIONS)) {
    app.post(`/quotations/:id/${verb}`, { preHandler: requirePermission(t.perm) }, async (req) => {
      const ctx = bizCtx(req);
      const id = idParam(req);
      return db.transaction(async (tx) => {
        const [row] = await tx
          .select({ q: quotations, customer: customers })
          .from(quotations)
          .innerJoin(customers, eq(customers.id, quotations.customerId))
          .where(own(quotations, ctx, id))
          .for('update', { of: quotations });
        if (!row) throw notFound();
        if (!t.from.includes(row.q.status)) throw new AppError('invalid_status_transition', `Cannot ${verb} a ${row.q.status} quotation`);
        if (verb === 'accept' && row.q.validUntil < today(ctx)) throw new AppError('invalid_status_transition', 'Quotation has expired');
        if (verb === 'send' && row.customer.email) {
          await sendDocumentEmail(
            req,
            row.customer.email,
            `${ctx.access.business.name}: ${row.q.number}`,
            `Dear ${row.customer.name},\n\nPlease find our quotation ${row.q.number} for ${row.q.currency} ${(row.q.total / 100).toFixed(2)}, valid until ${row.q.validUntil}.\n\n${ctx.access.business.name}`,
          );
        }
        const [u] = await tx.update(quotations).set({ status: t.to, updatedBy: ctx.user.id, updatedAt: new Date() }).where(eq(quotations.id, id)).returning();
        await audit(tx, { ...actor(ctx), action: `quotation.${t.to}`, entityType: 'quotation', entityId: id, metadata: { from: row.q.status, emailed: verb === 'send' && !!row.customer.email }, req });
        return { ...u, emailed: verb === 'send' && !!row.customer.email };
      });
    });
  }

  app.delete('/quotations/:id', { preHandler: requirePermission('quotations.delete') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [q] = await db.select({ status: quotations.status }).from(quotations).where(own(quotations, ctx, id));
    if (!q) throw notFound();
    if (q.status !== 'draft') throw new AppError('document_locked', 'Only drafts can be deleted');
    await db.delete(quotations).where(own(quotations, ctx, id));
    await audit(db, { ...actor(ctx), action: 'quotation.deleted', entityType: 'quotation', entityId: id, req });
    return { ok: true };
  });

  /**
   * Quotation → Invoice. Copies customer, item snapshots, prices, discounts, tax and service charge
   * exactly; generates a NEW invoice number; links source_quotation_id; marks the quotation converted.
   * Row lock + unique index on source_quotation_id prevent duplicate conversion.
   */
  app.post('/quotations/:id/convert', { preHandler: requirePermission('quotations.convert_to_invoice') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const invoice = await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotations).where(own(quotations, ctx, id)).for('update');
      if (!q) throw notFound();
      if (q.status === 'converted') throw new AppError('already_converted', 'Quotation already converted');
      if (q.status !== 'accepted') throw new AppError('invalid_status_transition', 'Only accepted quotations can be converted');
      const items = await tx.select().from(quotationItems).where(eq(quotationItems.quotationId, id)).orderBy(asc(quotationItems.position));
      const settings = await loadBusinessSettings(tx, ctx.businessId);
      const day = today(ctx);
      const due = new Date(`${day}T12:00:00Z`);
      due.setUTCDate(due.getUTCDate() + settings.invoice.defaultDueDays);
      const { number } = await allocateDocumentNumber(tx, { businessId: ctx.businessId, docType: 'invoice', numbering: settings.invoice.numbering });
      const [inv] = await tx
        .insert(invoices)
        .values({
          businessId: ctx.businessId,
          outletId: q.outletId,
          number,
          customerId: q.customerId,
          invoiceDate: day,
          dueDate: due.toISOString().slice(0, 10),
          salespersonId: q.salespersonId,
          status: 'draft',
          sourceQuotationId: q.id,
          language: q.language,
          notes: q.notes,
          terms: q.terms || settings.invoice.terms,
          currency: q.currency,
          subtotal: q.subtotal,
          discount: q.discount,
          orderDiscount: q.orderDiscount,
          serviceCharge: q.serviceCharge,
          tax: q.tax,
          total: q.total,
          balanceDue: q.total,
          taxConfig: q.taxConfig,
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        })
        .returning();
      await tx.insert(invoiceItems).values(
        items.map((i) => ({
          businessId: ctx.businessId,
          invoiceId: inv!.id,
          position: i.position,
          productId: i.productId,
          itemNameSnapshot: i.itemNameSnapshot,
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          discount: i.discount,
          taxRate: i.taxRate,
          tax: i.tax,
          total: i.total,
        })),
      );
      await tx.update(quotations).set({ status: 'converted', updatedBy: ctx.user.id, updatedAt: new Date() }).where(eq(quotations.id, id));
      await audit(tx, { ...actor(ctx), action: 'quotation.converted', entityType: 'quotation', entityId: id, metadata: { invoiceId: inv!.id, invoiceNumber: number }, req });
      await audit(tx, { ...actor(ctx), action: 'invoice.created', entityType: 'invoice', entityId: inv!.id, metadata: { number, fromQuotation: q.number }, req });
      return inv!;
    });
    reply.status(201);
    return invoice;
  });

  // ================================================================ INVOICES
  app.get('/invoices', { preHandler: requirePermission('invoices.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(listQuery, req.query);
    const t = today(ctx);
    const statusFilter =
      q.status === 'overdue'
        ? sql`(${invoices.status} IN ('issued','partially_paid') AND ${invoices.balanceDue} > 0 AND ${invoices.dueDate} < ${t})`
        : q.status === 'unpaid'
          ? sql`${invoices.status} IN ('issued','partially_paid')`
          : q.status
            ? eq(invoices.status, q.status)
            : undefined;
    const where = and(
      eq(invoices.businessId, ctx.businessId),
      statusFilter,
      q.customerId ? eq(invoices.customerId, q.customerId) : undefined,
      q.from ? gte(invoices.invoiceDate, q.from) : undefined,
      q.to ? lte(invoices.invoiceDate, q.to) : undefined,
      q.q ? or(ilike(invoices.number, `%${q.q}%`), ilike(customers.name, `%${q.q}%`)) : undefined,
    );
    const [items, [total], [sums]] = await Promise.all([
      db
        .select({ i: invoices, customerName: customers.name, salespersonName: users.name })
        .from(invoices)
        .innerJoin(customers, eq(customers.id, invoices.customerId))
        .leftJoin(users, eq(users.id, invoices.salespersonId))
        .where(where)
        .orderBy(desc(invoices.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db
        .select({ n: count() })
        .from(invoices)
        .innerJoin(customers, eq(customers.id, invoices.customerId))
        .where(where),
      db
        .select({
          outstanding: sql<string>`COALESCE(SUM(${invoices.balanceDue}) FILTER (WHERE ${invoices.status} IN ('issued','partially_paid')), 0)`,
          overdue: sql<string>`COALESCE(SUM(${invoices.balanceDue}) FILTER (WHERE ${invoices.status} IN ('issued','partially_paid') AND ${invoices.dueDate} < ${t}), 0)`,
        })
        .from(invoices)
        .where(eq(invoices.businessId, ctx.businessId)),
    ]);
    return {
      items: items.map((r) => ({ ...r.i, status: effectiveInvoiceStatus(r.i, t), customerName: r.customerName, salespersonName: r.salespersonName })),
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total?.n ?? 0),
      summary: { outstanding: Number(sums?.outstanding ?? 0), overdue: Number(sums?.overdue ?? 0) },
    };
  });

  app.get('/invoices/:id', { preHandler: requirePermission('invoices.view') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [row] = await db
      .select({ i: invoices, customer: customers, salespersonName: users.name })
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .leftJoin(users, eq(users.id, invoices.salespersonId))
      .where(own(invoices, ctx, id));
    if (!row) throw notFound();
    const [items, pays, quote] = await Promise.all([
      db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.position)),
      db
        .select({ p: payments, receivedByName: users.name })
        .from(payments)
        .leftJoin(users, eq(users.id, payments.receivedBy))
        .where(and(eq(payments.invoiceId, id), eq(payments.businessId, ctx.businessId), isNull(payments.voidedAt)))
        .orderBy(asc(payments.paidAt)),
      row.i.sourceQuotationId ? db.select({ id: quotations.id, number: quotations.number }).from(quotations).where(eq(quotations.id, row.i.sourceQuotationId)) : Promise.resolve([]),
    ]);
    return {
      invoice: { ...row.i, status: effectiveInvoiceStatus(row.i, today(ctx)), salespersonName: row.salespersonName },
      customer: row.customer,
      items,
      payments: pays.map((p) => ({ ...p.p, receivedByName: p.receivedByName })),
      quotation: quote[0] ?? null,
      branding: await documentBranding(db, ctx, row.i.createdBy),
      ...(await documentContext(db, ctx, 'invoice', row.i.language)),
    };
  });

  app.post('/invoices', { preHandler: requirePermission('invoices.create') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(invoiceSchema, req.body);
    if (body.dueDate < body.invoiceDate) throw new AppError('validation_failed', 'Invalid dates', { fields: { dueDate: { code: 'invalid' } } });
    const inv = await db.transaction(async (tx) => {
      await assertCustomer(tx, ctx, body.customerId);
      const salespersonId = await resolveSalesperson(tx, ctx, body.salespersonId);
      const settings = await loadBusinessSettings(tx, ctx.businessId);
      const { rows, totals } = priceDocument(body.items, body.discount, settings.tax);
      const { number } = await allocateDocumentNumber(tx, { businessId: ctx.businessId, docType: 'invoice', numbering: settings.invoice.numbering, date: new Date(`${body.invoiceDate}T12:00:00Z`) });
      const [i] = await tx
        .insert(invoices)
        .values({
          businessId: ctx.businessId,
          outletId: ctx.outletId,
          number,
          customerId: body.customerId,
          invoiceDate: body.invoiceDate,
          dueDate: body.dueDate,
          salespersonId,
          language: body.language,
          notes: body.notes,
          terms: body.terms,
          currency: ctx.access.business.currency,
          taxConfig: settings.tax,
          balanceDue: totals.total,
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
          ...totals,
        })
        .returning();
      await tx.insert(invoiceItems).values(rows.map((r) => ({ ...r, businessId: ctx.businessId, invoiceId: i!.id })));
      await audit(tx, { ...actor(ctx), action: 'invoice.created', entityType: 'invoice', entityId: i!.id, metadata: { number, total: totals.total }, req });
      await notifyPermission(tx, ctx.businessId, 'invoices.view', 'notify.invoice_created', { number }, `/invoices/${i!.id}`);
      return i!;
    });
    reply.status(201);
    return inv;
  });

  app.put('/invoices/:id', { preHandler: requirePermission('invoices.edit') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(invoiceSchema, req.body);
    return db.transaction(async (tx) => {
      const [i] = await tx.select().from(invoices).where(own(invoices, ctx, id)).for('update');
      if (!i) throw notFound();
      if (i.status !== 'draft') throw new AppError('document_locked', 'Only draft invoices can be edited');
      await assertCustomer(tx, ctx, body.customerId);
      const salespersonId = await resolveSalesperson(tx, ctx, body.salespersonId ?? i.salespersonId);
      const settings = await loadBusinessSettings(tx, ctx.businessId);
      const { rows, totals } = priceDocument(body.items, body.discount, settings.tax);
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      await tx.insert(invoiceItems).values(rows.map((r) => ({ ...r, businessId: ctx.businessId, invoiceId: id })));
      const [u] = await tx
        .update(invoices)
        .set({
          customerId: body.customerId,
          invoiceDate: body.invoiceDate,
          dueDate: body.dueDate,
          salespersonId,
          language: body.language,
          notes: body.notes,
          terms: body.terms,
          taxConfig: settings.tax,
          balanceDue: totals.total,
          updatedBy: ctx.user.id,
          updatedAt: new Date(),
          ...totals,
        })
        .where(eq(invoices.id, id))
        .returning();
      await audit(tx, { ...actor(ctx), action: 'invoice.updated', entityType: 'invoice', entityId: id, metadata: { total: totals.total }, req });
      return u;
    });
  });

  app.post('/invoices/:id/issue', { preHandler: requirePermission('invoices.edit') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    return db.transaction(async (tx) => {
      const [i] = await tx.select().from(invoices).where(own(invoices, ctx, id)).for('update');
      if (!i) throw notFound();
      if (i.status !== 'draft') throw new AppError('invalid_status_transition', 'Only drafts can be issued');
      const [u] = await tx.update(invoices).set({ status: 'issued', issuedAt: new Date(), updatedBy: ctx.user.id, updatedAt: new Date() }).where(eq(invoices.id, id)).returning();
      await audit(tx, { ...actor(ctx), action: 'invoice.issued', entityType: 'invoice', entityId: id, req });
      return u;
    });
  });

  app.post('/invoices/:id/send', { preHandler: requirePermission('invoices.send') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [row] = await db
      .select({ i: invoices, customer: customers })
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .where(own(invoices, ctx, id));
    if (!row) throw notFound();
    if (row.i.status === 'draft' || row.i.status === 'void' || row.i.status === 'cancelled') throw new AppError('invalid_status_transition', 'Issue the invoice before sending');
    if (!row.customer.email) throw new AppError('validation_failed', 'Customer has no email', { fields: { email: { code: 'required' } } });
    await sendDocumentEmail(
      req,
      row.customer.email,
      `${ctx.access.business.name}: ${row.i.number}`,
      `Dear ${row.customer.name},\n\nInvoice ${row.i.number} for ${row.i.currency} ${(row.i.total / 100).toFixed(2)} is due on ${row.i.dueDate}. Balance due: ${row.i.currency} ${(row.i.balanceDue / 100).toFixed(2)}.\n\n${ctx.access.business.name}`,
    );
    await audit(db, { ...actor(ctx), action: 'invoice.sent', entityType: 'invoice', entityId: id, req });
    return { ok: true };
  });

  app.post('/invoices/:id/cancel', { preHandler: requirePermission('invoices.edit') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [i] = await db.select({ status: invoices.status }).from(invoices).where(own(invoices, ctx, id));
    if (!i) throw notFound();
    if (i.status !== 'draft') throw new AppError('invalid_status_transition', 'Only drafts can be cancelled; void issued invoices');
    const [u] = await db.update(invoices).set({ status: 'cancelled', balanceDue: 0, updatedAt: new Date() }).where(own(invoices, ctx, id)).returning();
    await audit(db, { ...actor(ctx), action: 'invoice.cancelled', entityType: 'invoice', entityId: id, req });
    return u;
  });

  app.post('/invoices/:id/void', { preHandler: requirePermission('invoices.void') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const { reason } = parse(voidSchema, req.body);
    return db.transaction(async (tx) => {
      const [i] = await tx.select().from(invoices).where(own(invoices, ctx, id)).for('update');
      if (!i) throw notFound();
      if (!['issued', 'partially_paid', 'paid'].includes(i.status)) throw new AppError('invalid_status_transition', 'Only issued invoices can be voided');
      if (i.paidAmount > 0) throw new AppError('invalid_status_transition', 'Invoices with payments cannot be voided');
      const [u] = await tx.update(invoices).set({ status: 'void', balanceDue: 0, voidReason: reason, updatedBy: ctx.user.id, updatedAt: new Date() }).where(eq(invoices.id, id)).returning();
      await audit(tx, { ...actor(ctx), action: 'invoice.voided', entityType: 'invoice', entityId: id, metadata: { reason }, req });
      return u;
    });
  });

  app.delete('/invoices/:id', { preHandler: requirePermission('invoices.delete') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [i] = await db.select({ status: invoices.status, sourceQuotationId: invoices.sourceQuotationId }).from(invoices).where(own(invoices, ctx, id));
    if (!i) throw notFound();
    if (i.status !== 'draft' && i.status !== 'cancelled') throw new AppError('document_locked', 'Only draft or cancelled invoices can be deleted');
    await db.transaction(async (tx) => {
      await tx.delete(invoices).where(own(invoices, ctx, id));
      if (i.sourceQuotationId) await tx.update(quotations).set({ status: 'accepted' }).where(and(eq(quotations.id, i.sourceQuotationId), eq(quotations.businessId, ctx.businessId)));
      await audit(tx, { ...actor(ctx), action: 'invoice.deleted', entityType: 'invoice', entityId: id, req });
    });
    return { ok: true };
  });

  /** Record a (partial or full) payment. Amount is validated against the server-side balance under a row lock. */
  app.post('/invoices/:id/payments', { preHandler: requirePermission('invoices.payment') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(recordPaymentSchema, req.body);
    const amount = toMinor(body.amount);
    const result = await db.transaction(async (tx) => {
      const [i] = await tx.select().from(invoices).where(own(invoices, ctx, id)).for('update');
      if (!i) throw notFound();
      if (!['issued', 'partially_paid'].includes(i.status)) throw new AppError('invalid_status_transition', 'Invoice is not open for payment');
      if (amount > i.balanceDue) throw new AppError('payment_exceeds_balance', 'Payment exceeds the balance due', { details: { balanceDue: i.balanceDue } });
      const paid = i.paidAmount + amount;
      const balance = i.total - paid;
      const status = balance === 0 ? 'paid' : 'partially_paid';
      await tx.insert(payments).values({
        businessId: ctx.businessId,
        outletId: ctx.outletId,
        customerId: i.customerId,
        invoiceId: id,
        kind: 'invoice',
        method: body.method,
        amount,
        reference: body.reference,
        notes: body.notes,
        receivedBy: ctx.user.id,
        paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
      });
      const [u] = await tx.update(invoices).set({ paidAmount: paid, balanceDue: balance, status, updatedBy: ctx.user.id, updatedAt: new Date() }).where(eq(invoices.id, id)).returning();
      await audit(tx, { ...actor(ctx), action: 'invoice.payment_added', entityType: 'invoice', entityId: id, metadata: { amount, method: body.method, balance }, req });
      if (status === 'paid') await notifyPermission(tx, ctx.businessId, 'invoices.view', 'notify.invoice_paid', { number: i.number }, `/invoices/${id}`);
      return u;
    });
    reply.status(201);
    return result;
  });
}
