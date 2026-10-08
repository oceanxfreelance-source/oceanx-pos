import type { FastifyInstance } from 'fastify';
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  EXPENSE_CATEGORIES,
  expenseSchema,
  paginationQuerySchema,
  purchasePaymentSchema,
  purchaseSchema,
  stockAdjustSchema,
  supplierSchema,
  toMinor,
  transferSchema,
} from '@oceanx/shared';
import { expenses, inventoryTransactions, outlets, products, purchaseItems, purchases, stockLevels, stockTransfers, suppliers, users } from '../../db/schema';
import { bizCtx, requirePermission } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { contentTypeFor } from '../../lib/storage';
import { actor, own, requireOutlet, round3 } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import { allocateDocumentNumber } from '../../services/sequences';
import { moveStock, notifyLowStock, outletBelongs } from '../../services/ops/inventory';

const PURCHASE_NUMBERING = { prefix: 'PO', startNumber: 1, padding: 5, format: '{PREFIX}-{YYYY}-{SEQ}', reset: 'yearly' as const };

export async function operationsRoutes(app: FastifyInstance) {
  const { db, storage } = app.deps;

  // ================================================================ SUPPLIERS
  app.get('/suppliers', { preHandler: requirePermission('suppliers.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(paginationQuerySchema, req.query);
    const where = and(eq(suppliers.businessId, ctx.businessId), q.q ? or(ilike(suppliers.name, `%${q.q}%`), ilike(suppliers.phone, `%${q.q}%`)) : undefined);
    const [items, [total]] = await Promise.all([
      db
        .select({
          s: suppliers,
          purchaseTotal: sql<string>`(SELECT COALESCE(SUM(total),0) FROM purchases p WHERE p.supplier_id = "suppliers"."id" AND p.status = 'received')`,
          unpaid: sql<string>`(SELECT COALESCE(SUM(total - paid_amount),0) FROM purchases p WHERE p.supplier_id = "suppliers"."id" AND p.status = 'received')`,
        })
        .from(suppliers)
        .where(where)
        .orderBy(asc(suppliers.name))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(suppliers).where(where),
    ]);
    return { items: items.map((r) => ({ ...r.s, purchaseTotal: Number(r.purchaseTotal), unpaid: Number(r.unpaid) })), page: q.page, pageSize: q.pageSize, total: Number(total?.n ?? 0) };
  });

  app.get('/suppliers/:id', { preHandler: requirePermission('suppliers.view') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [s] = await db.select().from(suppliers).where(own(suppliers, ctx, id));
    if (!s) throw notFound();
    const history = ctx.permissions.has('purchases.view')
      ? await db
          .select()
          .from(purchases)
          .where(and(eq(purchases.businessId, ctx.businessId), eq(purchases.supplierId, id)))
          .orderBy(desc(purchases.createdAt))
          .limit(50)
      : null;
    return { supplier: s, purchases: history };
  });

  app.post('/suppliers', { preHandler: requirePermission('suppliers.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(supplierSchema, req.body);
    const [s] = await db
      .insert(suppliers)
      .values({ ...body, businessId: ctx.businessId })
      .returning();
    await audit(db, { ...actor(ctx), action: 'supplier.created', entityType: 'supplier', entityId: s!.id, req });
    reply.status(201);
    return s;
  });

  app.put('/suppliers/:id', { preHandler: requirePermission('suppliers.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(supplierSchema, req.body);
    const [s] = await db
      .update(suppliers)
      .set({ ...body, updatedAt: new Date() })
      .where(own(suppliers, ctx, idParam(req)))
      .returning();
    if (!s) throw notFound();
    return s;
  });

  // ================================================================ PURCHASES
  app.get('/purchases', { preHandler: requirePermission('purchases.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(paginationQuerySchema.extend({ status: z.enum(['draft', 'received', 'cancelled']).optional(), supplierId: z.uuid().optional() }), req.query);
    const where = and(
      eq(purchases.businessId, ctx.businessId),
      q.status ? eq(purchases.status, q.status) : undefined,
      q.supplierId ? eq(purchases.supplierId, q.supplierId) : undefined,
      q.q ? or(ilike(purchases.number, `%${q.q}%`), ilike(suppliers.name, `%${q.q}%`), ilike(purchases.reference, `%${q.q}%`)) : undefined,
    );
    const [items, [total]] = await Promise.all([
      db
        .select({ p: purchases, supplierName: suppliers.name })
        .from(purchases)
        .innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
        .where(where)
        .orderBy(desc(purchases.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db
        .select({ n: count() })
        .from(purchases)
        .innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
        .where(where),
    ]);
    return { items: items.map((r) => ({ ...r.p, supplierName: r.supplierName })), page: q.page, pageSize: q.pageSize, total: Number(total?.n ?? 0) };
  });

  app.get('/purchases/:id', { preHandler: requirePermission('purchases.view') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [row] = await db
      .select({ p: purchases, supplier: suppliers })
      .from(purchases)
      .innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
      .where(own(purchases, ctx, id));
    if (!row) throw notFound();
    const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id));
    return { purchase: row.p, supplier: row.supplier, items };
  });

  async function purchaseRows(ctx: ReturnType<typeof bizCtx>, body: z.output<typeof purchaseSchema>) {
    const [s] = await db.select({ id: suppliers.id }).from(suppliers).where(own(suppliers, ctx, body.supplierId));
    if (!s) throw new AppError('validation_failed', 'Unknown supplier', { fields: { supplierId: { code: 'invalid_option' } } });
    const ids = [...new Set(body.items.map((i) => i.productId))];
    const prods = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.businessId, ctx.businessId), inArray(products.id, ids), isNull(products.deletedAt)));
    if (prods.length !== ids.length) throw new AppError('validation_failed', 'Unknown product', { fields: { items: { code: 'invalid_option' } } });
    const rows = body.items.map((i) => {
      // Bulk buys: the total paid for the line is kept exactly and the unit cost is derived from it.
      const total = i.lineTotal !== undefined ? toMinor(i.lineTotal) : Math.round(toMinor(i.unitCost ?? 0) * i.quantity);
      const unitCost = i.lineTotal !== undefined ? Math.round(total / i.quantity) : toMinor(i.unitCost ?? 0);
      return { productId: i.productId, nameSnapshot: prods.find((p) => p.id === i.productId)!.name, quantity: i.quantity, unitCost, total };
    });
    return { rows, total: rows.reduce((a, r) => a + r.total, 0) };
  }

  app.post('/purchases', { preHandler: requirePermission('purchases.create') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(purchaseSchema, req.body);
    const outletId = requireOutlet(ctx);
    const { rows, total } = await purchaseRows(ctx, body);
    const p = await db.transaction(async (tx) => {
      const { number } = await allocateDocumentNumber(tx, { businessId: ctx.businessId, docType: 'purchase', numbering: PURCHASE_NUMBERING });
      const [p] = await tx
        .insert(purchases)
        .values({ businessId: ctx.businessId, outletId, supplierId: body.supplierId, number, purchaseDate: body.purchaseDate, reference: body.reference, notes: body.notes, total, createdBy: ctx.user.id })
        .returning();
      await tx.insert(purchaseItems).values(rows.map((r) => ({ ...r, businessId: ctx.businessId, purchaseId: p!.id })));
      await audit(tx, { ...actor(ctx), action: 'purchase.created', entityType: 'purchase', entityId: p!.id, metadata: { number, total }, req });
      return p!;
    });
    reply.status(201);
    return p;
  });

  app.put('/purchases/:id', { preHandler: requirePermission('purchases.edit') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(purchaseSchema, req.body);
    const { rows, total } = await purchaseRows(ctx, body);
    return db.transaction(async (tx) => {
      const [p] = await tx.select().from(purchases).where(own(purchases, ctx, id)).for('update');
      if (!p) throw notFound();
      if (p.status !== 'draft') throw new AppError('document_locked', 'Only draft purchases can be edited');
      await tx.delete(purchaseItems).where(eq(purchaseItems.purchaseId, id));
      await tx.insert(purchaseItems).values(rows.map((r) => ({ ...r, businessId: ctx.businessId, purchaseId: id })));
      const [u] = await tx
        .update(purchases)
        .set({ supplierId: body.supplierId, purchaseDate: body.purchaseDate, reference: body.reference, notes: body.notes, total, updatedAt: new Date() })
        .where(eq(purchases.id, id))
        .returning();
      return u;
    });
  });

  /** Receiving a purchase adds stock at the purchase outlet and updates product cost (moving weighted average). */
  app.post('/purchases/:id/receive', { preHandler: requirePermission('purchases.edit', 'inventory.adjust') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    return db.transaction(async (tx) => {
      const [p] = await tx.select().from(purchases).where(own(purchases, ctx, id)).for('update');
      if (!p) throw notFound();
      if (p.status !== 'draft') throw new AppError('invalid_status_transition', 'Purchase already received or cancelled');
      const items = await tx.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id));
      for (const it of [...items].sort((a, b) => a.productId.localeCompare(b.productId))) {
        const [prod] = await tx.select({ costPrice: products.costPrice }).from(products).where(eq(products.id, it.productId)).for('update');
        const [lvl] = await tx
          .select({ q: sql<string>`COALESCE(SUM(quantity),0)` })
          .from(stockLevels)
          .where(and(eq(stockLevels.businessId, ctx.businessId), eq(stockLevels.productId, it.productId)));
        const onHand = Math.max(0, Number(lvl?.q ?? 0));
        const newCost = onHand + it.quantity > 0 ? Math.round((onHand * (prod?.costPrice ?? 0) + it.total) / (onHand + it.quantity)) : it.unitCost;
        await tx.update(products).set({ costPrice: newCost, updatedAt: new Date() }).where(eq(products.id, it.productId));
        await moveStock(tx, {
          businessId: ctx.businessId,
          outletId: p.outletId,
          productId: it.productId,
          delta: it.quantity,
          type: 'purchase',
          referenceType: 'purchase',
          referenceId: id,
          unitCost: it.unitCost,
          userId: ctx.user.id,
        });
      }
      const [u] = await tx.update(purchases).set({ status: 'received', receivedAt: new Date(), updatedAt: new Date() }).where(eq(purchases.id, id)).returning();
      await audit(tx, { ...actor(ctx), action: 'purchase.received', entityType: 'purchase', entityId: id, metadata: { number: p.number }, req });
      return u;
    });
  });

  app.post('/purchases/:id/cancel', { preHandler: requirePermission('purchases.edit') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [p] = await db.select({ status: purchases.status }).from(purchases).where(own(purchases, ctx, id));
    if (!p) throw notFound();
    if (p.status !== 'draft') throw new AppError('invalid_status_transition', 'Only draft purchases can be cancelled');
    const [u] = await db.update(purchases).set({ status: 'cancelled', updatedAt: new Date() }).where(own(purchases, ctx, id)).returning();
    await audit(db, { ...actor(ctx), action: 'purchase.cancelled', entityType: 'purchase', entityId: id, req });
    return u;
  });

  app.post('/purchases/:id/payments', { preHandler: requirePermission('purchases.edit') }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const body = parse(purchasePaymentSchema, req.body);
    const amount = toMinor(body.amount);
    return db.transaction(async (tx) => {
      const [p] = await tx.select().from(purchases).where(own(purchases, ctx, id)).for('update');
      if (!p) throw notFound();
      if (p.status === 'cancelled') throw new AppError('invalid_status_transition', 'Purchase is cancelled');
      if (p.paidAmount + amount > p.total) throw new AppError('payment_exceeds_balance', 'Payment exceeds the amount owed', { details: { balance: p.total - p.paidAmount } });
      const paid = p.paidAmount + amount;
      const [u] = await tx
        .update(purchases)
        .set({ paidAmount: paid, paymentStatus: paid >= p.total ? 'paid' : 'partial', updatedAt: new Date() })
        .where(eq(purchases.id, id))
        .returning();
      await audit(tx, { ...actor(ctx), action: 'purchase.payment_added', entityType: 'purchase', entityId: id, metadata: { amount, method: body.method }, req });
      return u;
    });
  });

  // ================================================================ EXPENSES
  const expenseQuery = paginationQuerySchema.extend({ category: z.enum(EXPENSE_CATEGORIES).optional(), from: z.iso.date().optional(), to: z.iso.date().optional() });

  app.get('/expenses', { preHandler: requirePermission('expenses.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(expenseQuery, req.query);
    const where = and(
      eq(expenses.businessId, ctx.businessId),
      isNull(expenses.deletedAt),
      q.category ? eq(expenses.category, q.category) : undefined,
      q.from ? gte(expenses.expenseDate, q.from) : undefined,
      q.to ? lte(expenses.expenseDate, q.to) : undefined,
      q.q ? or(ilike(expenses.payee, `%${q.q}%`), ilike(expenses.notes, `%${q.q}%`), ilike(expenses.reference, `%${q.q}%`)) : undefined,
    );
    const [items, [agg]] = await Promise.all([
      db
        .select({ e: expenses, createdByName: users.name })
        .from(expenses)
        .leftJoin(users, eq(users.id, expenses.createdBy))
        .where(where)
        .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count(), sum: sql<string>`COALESCE(SUM(${expenses.amount}),0)` }).from(expenses).where(where),
    ]);
    return {
      items: items.map((r) => ({ ...r.e, hasAttachment: !!r.e.attachmentPath, attachmentPath: undefined, createdByName: r.createdByName })),
      page: q.page,
      pageSize: q.pageSize,
      total: Number(agg?.n ?? 0),
      sum: Number(agg?.sum ?? 0),
    };
  });

  app.post('/expenses', { preHandler: requirePermission('expenses.create') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(expenseSchema, req.body);
    const [e] = await db
      .insert(expenses)
      .values({ ...body, amount: toMinor(body.amount), businessId: ctx.businessId, outletId: requireOutlet(ctx), createdBy: ctx.user.id })
      .returning();
    await audit(db, { ...actor(ctx), action: 'expense.created', entityType: 'expense', entityId: e!.id, metadata: { amount: e!.amount, category: e!.category }, req });
    reply.status(201);
    return e;
  });

  app.put('/expenses/:id', { preHandler: requirePermission('expenses.edit') }, async (req) => {
    const ctx = bizCtx(req);
    const body = parse(expenseSchema, req.body);
    const [e] = await db
      .update(expenses)
      .set({ ...body, amount: toMinor(body.amount), updatedAt: new Date() })
      .where(own(expenses, ctx, idParam(req)))
      .returning();
    if (!e) throw notFound();
    await audit(db, { ...actor(ctx), action: 'expense.updated', entityType: 'expense', entityId: e.id, req });
    return e;
  });

  app.delete('/expenses/:id', { preHandler: requirePermission('expenses.delete') }, async (req) => {
    const ctx = bizCtx(req);
    const [e] = await db.update(expenses).set({ deletedAt: new Date() }).where(own(expenses, ctx, idParam(req))).returning({ id: expenses.id });
    if (!e) throw notFound();
    await audit(db, { ...actor(ctx), action: 'expense.deleted', entityType: 'expense', entityId: e.id, req });
    return { ok: true };
  });

  app.put('/expenses/:id/attachment', { preHandler: requirePermission('expenses.edit'), bodyLimit: 5_242_880 }, async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const [e] = await db.select({ attachmentPath: expenses.attachmentPath }).from(expenses).where(own(expenses, ctx, id));
    if (!e) throw notFound();
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new AppError('validation_failed', 'File required', { fields: { file: { code: 'invalid_image' } } });
    const saved = await storage.saveBusinessDocument(ctx.businessId, `expense-${id}`, req.body);
    await db.update(expenses).set({ attachmentPath: saved.rel }).where(own(expenses, ctx, id));
    if (e.attachmentPath) await storage.remove(e.attachmentPath);
    return { ok: true };
  });

  app.get('/expenses/:id/attachment', { preHandler: requirePermission('expenses.view') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const [e] = await db.select({ attachmentPath: expenses.attachmentPath }).from(expenses).where(own(expenses, ctx, idParam(req)));
    if (!e?.attachmentPath) throw notFound();
    reply.header('content-type', contentTypeFor(e.attachmentPath)).header('content-disposition', 'inline').header('x-content-type-options', 'nosniff').header('cache-control', 'private, no-store');
    return reply.send(await storage.read(e.attachmentPath));
  });

  // ================================================================ INVENTORY
  app.get('/inventory', { preHandler: requirePermission('inventory.view') }, async (req) => {
    const ctx = bizCtx(req);
    const outletId = requireOutlet(ctx);
    const q = parse(paginationQuerySchema.extend({ low: z.enum(['true']).optional(), kind: z.enum(['selling', 'supplies']).optional() }), req.query);
    const stockExpr = sql<string>`COALESCE((SELECT quantity FROM stock_levels s WHERE s.product_id = "products"."id" AND s.outlet_id = ${outletId}), 0)`;
    const where = and(
      eq(products.businessId, ctx.businessId),
      isNull(products.deletedAt),
      eq(products.trackStock, true),
      q.q ? or(ilike(products.name, `%${q.q}%`), ilike(products.sku, `%${q.q}%`)) : undefined,
      q.low ? sql`${stockExpr} <= ${products.minStock}` : undefined,
      q.kind === 'supplies' ? eq(products.type, 'ingredient') : q.kind === 'selling' ? sql`${products.type} <> 'ingredient'` : undefined,
    );
    const [items, [total], [value]] = await Promise.all([
      db
        .select({ id: products.id, name: products.name, sku: products.sku, unit: products.unit, type: products.type, minStock: products.minStock, costPrice: products.costPrice, quantity: stockExpr })
        .from(products)
        .where(where)
        .orderBy(asc(products.name))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(products).where(where),
      db
        .select({ v: sql<string>`COALESCE(SUM(GREATEST(s.quantity,0) * p.cost_price),0)` })
        .from(sql`stock_levels s JOIN products p ON p.id = s.product_id`)
        .where(sql`s.business_id = ${ctx.businessId} AND s.outlet_id = ${outletId}`),
    ]);
    return {
      items: items.map((i) => ({ ...i, quantity: Number(i.quantity), low: Number(i.quantity) <= i.minStock })),
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total?.n ?? 0),
      stockValue: Math.round(Number(value?.v ?? 0)),
    };
  });

  app.post('/inventory/adjust', { preHandler: requirePermission('inventory.adjust') }, async (req) => {
    const ctx = bizCtx(req);
    const outletId = requireOutlet(ctx);
    const body = parse(stockAdjustSchema, req.body);
    const [p] = await db.select({ id: products.id }).from(products).where(own(products, ctx, body.productId));
    if (!p) throw notFound();
    const balance = await db.transaction(async (tx) => {
      let delta = body.quantity;
      if (body.mode === 'remove' || body.mode === 'wastage') delta = -body.quantity;
      if (body.mode === 'set') {
        const [lvl] = await tx
          .select({ q: stockLevels.quantity })
          .from(stockLevels)
          .where(and(eq(stockLevels.outletId, outletId), eq(stockLevels.productId, body.productId)))
          .for('update');
        delta = round3(body.quantity - Number(lvl?.q ?? 0));
      }
      const b = await moveStock(tx, {
        businessId: ctx.businessId,
        outletId,
        productId: body.productId,
        delta,
        type: body.mode === 'wastage' ? 'wastage' : body.mode === 'set' ? 'count' : 'adjustment',
        note: body.reason,
        userId: ctx.user.id,
        allowNegative: false,
      });
      await audit(tx, { ...actor(ctx), action: 'inventory.adjusted', entityType: 'product', entityId: body.productId, metadata: { mode: body.mode, delta, balance: b }, req });
      const [prod] = await tx.select({ minStock: products.minStock }).from(products).where(eq(products.id, body.productId));
      if (prod && prod.minStock > 0 && b <= prod.minStock) await notifyLowStock(tx, ctx.businessId, [{ productId: body.productId, balance: b }]);
      return b;
    });
    return { balance };
  });

  app.get('/inventory/history', { preHandler: requirePermission('inventory.view') }, async (req) => {
    const ctx = bizCtx(req);
    const q = parse(paginationQuerySchema.extend({ productId: z.uuid().optional(), type: z.string().max(20).optional() }), req.query);
    const where = and(
      eq(inventoryTransactions.businessId, ctx.businessId),
      q.productId ? eq(inventoryTransactions.productId, q.productId) : undefined,
      q.type ? eq(inventoryTransactions.type, q.type) : undefined,
    );
    const [items, [total]] = await Promise.all([
      db
        .select({ t: inventoryTransactions, productName: products.name, unit: products.unit, outletName: outlets.name, userName: users.name })
        .from(inventoryTransactions)
        .innerJoin(products, eq(products.id, inventoryTransactions.productId))
        .innerJoin(outlets, eq(outlets.id, inventoryTransactions.outletId))
        .leftJoin(users, eq(users.id, inventoryTransactions.userId))
        .where(where)
        .orderBy(desc(inventoryTransactions.createdAt), desc(inventoryTransactions.id))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(inventoryTransactions).where(where),
    ]);
    return { items: items.map((r) => ({ ...r.t, productName: r.productName, unit: r.unit, outletName: r.outletName, userName: r.userName })), page: q.page, pageSize: q.pageSize, total: Number(total?.n ?? 0) };
  });

  // ---------------------------------------------------------------- transfers (advanced inventory + multi-outlet)
  app.get('/inventory/transfers', { preHandler: requirePermission('transfers.manage') }, async (req) => {
    const ctx = bizCtx(req);
    const rows = await db.select().from(stockTransfers).where(eq(stockTransfers.businessId, ctx.businessId)).orderBy(desc(stockTransfers.createdAt)).limit(100);
    return { items: rows };
  });

  app.post('/inventory/transfers', { preHandler: requirePermission('transfers.manage') }, async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(transferSchema, req.body);
    if (body.fromOutletId === body.toOutletId) throw new AppError('validation_failed', 'Choose two different outlets', { fields: { toOutletId: { code: 'invalid_option' } } });
    const t = await db.transaction(async (tx) => {
      if (!(await outletBelongs(tx, ctx.businessId, body.fromOutletId)) || !(await outletBelongs(tx, ctx.businessId, body.toOutletId))) throw notFound();
      const ids = [...new Set(body.items.map((i) => i.productId))];
      const prods = await tx
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(and(eq(products.businessId, ctx.businessId), inArray(products.id, ids)));
      if (prods.length !== ids.length) throw new AppError('validation_failed', 'Unknown product', { fields: { items: { code: 'invalid_option' } } });
      const [t] = await tx
        .insert(stockTransfers)
        .values({
          businessId: ctx.businessId,
          fromOutletId: body.fromOutletId,
          toOutletId: body.toOutletId,
          notes: body.notes,
          items: body.items.map((i) => ({ productId: i.productId, name: prods.find((p) => p.id === i.productId)!.name, quantity: i.quantity })),
          createdBy: ctx.user.id,
        })
        .returning();
      for (const i of [...body.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
        await moveStock(tx, { businessId: ctx.businessId, outletId: body.fromOutletId, productId: i.productId, delta: -i.quantity, type: 'transfer_out', referenceType: 'transfer', referenceId: t!.id, userId: ctx.user.id });
        await moveStock(tx, { businessId: ctx.businessId, outletId: body.toOutletId, productId: i.productId, delta: i.quantity, type: 'transfer_in', referenceType: 'transfer', referenceId: t!.id, userId: ctx.user.id });
      }
      await audit(tx, { ...actor(ctx), action: 'inventory.transferred', entityType: 'transfer', entityId: t!.id, req });
      return t!;
    });
    reply.status(201);
    return t;
  });
}
