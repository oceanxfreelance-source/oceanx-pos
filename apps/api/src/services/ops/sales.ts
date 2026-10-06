import type { FastifyRequest } from 'fastify';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { calculateTotals, resolveOptions, toMinor, type completeOrderSchema, type posOrderSchema } from '@oceanx/shared';
import type { Executor } from '../../db/client';
import { categories, customers, diningTables, kitchenOrders, loyaltyTransactions, payments, products, saleItems, sales } from '../../db/schema';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { actor, businessToday, requireOutlet } from '../../lib/tenant';
import type { BusinessContext } from '../../types';
import { allocateDocumentNumber } from '../sequences';
import { loadBusinessSettings } from '../settings';
import { notifyPermission } from '../notifications';
import { lockCustomer, totalOutstanding } from './customers';
import { consumeForSale, notifyLowStock } from './inventory';

type OrderInput = z.output<typeof posOrderSchema>;
type PaymentsInput = z.output<typeof completeOrderSchema>['payments'];

interface PricedLine {
  productId: string;
  categoryId: string | null;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  options: { group: string; choice: string; price: number }[];
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  costPrice: number;
  note: string;
  sendToKitchen: boolean;
  station: string;
}

/**
 * Price an order entirely from server-side data (catalog prices, option prices, tax settings).
 * Client-provided prices or totals are never used.
 */
export async function priceOrder(tx: Executor, ctx: BusinessContext, input: OrderInput, opts: { skipDiscountCheck?: boolean } = {}) {
  const settings = await loadBusinessSettings(tx, ctx.businessId);
  const ids = [...new Set(input.items.map((i) => i.productId))];
  const rows = await tx
    .select({ p: products, station: categories.kitchenStation })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.businessId, ctx.businessId), inArray(products.id, ids), isNull(products.deletedAt)));
  const byId = new Map(rows.map((r) => [r.p.id, r]));

  const lineDiscounts = input.items.map((i) => toMinor(i.discount));
  const orderDiscount = toMinor(input.discount);
  if (!opts.skipDiscountCheck && (orderDiscount > 0 || lineDiscounts.some((d) => d > 0)) && !ctx.permissions.has('pos.discount')) {
    throw new AppError('discount_not_allowed', 'You are not allowed to give discounts');
  }

  const draft = input.items.map((item, idx) => {
    const r = byId.get(item.productId);
    if (!r || !r.p.isActive || r.p.type === 'ingredient') throw new AppError('product_unavailable', 'Product unavailable', { details: { productId: item.productId } });
    const resolved = resolveOptions(r.p.options ?? [], item.options);
    if (!resolved.ok) throw new AppError('validation_failed', 'Invalid options', { fields: { [`items.${idx}.options`]: { code: resolved.error } } });
    return { item, product: r.p, station: r.station ?? '', unitPrice: r.p.sellingPrice + resolved.delta, options: resolved.snapshot, discount: lineDiscounts[idx]! };
  });

  // Loyalty redemption is converted to an order-level discount at the configured point value.
  let pointsDiscount = 0;
  if (input.redeemPoints > 0) {
    if (!ctx.access.addons.has('loyalty')) throw new AppError('addon_not_enabled', 'Loyalty add-on not enabled', { details: { addon: 'loyalty' } });
    if (!input.customerId) throw new AppError('customer_required', 'Select a customer to redeem points');
    if (input.redeemPoints < settings.loyalty.minRedeemPoints) throw new AppError('points_insufficient', 'Below minimum redeemable points');
    pointsDiscount = Math.round(input.redeemPoints * settings.loyalty.pointValue);
  }

  const calc = calculateTotals(
    draft.map((d) => ({ quantity: d.item.quantity, unitPrice: d.unitPrice, discount: d.discount, taxRate: d.product.taxRate })),
    settings.tax,
    orderDiscount + pointsDiscount,
  );
  const maxPct = settings.pos.maxDiscountPercent;
  if (!opts.skipDiscountCheck && calc.subtotal > 0 && (calc.discount - pointsDiscount) / calc.subtotal > maxPct / 100 + 1e-9) {
    throw new AppError('discount_not_allowed', 'Discount exceeds the allowed maximum', { details: { maxPercent: maxPct } });
  }

  let deliveryFee = 0;
  if (input.orderType === 'delivery') {
    if (!ctx.access.addons.has('delivery')) throw new AppError('addon_not_enabled', 'Delivery add-on not enabled', { details: { addon: 'delivery' } });
    deliveryFee = toMinor(input.delivery?.fee ?? 0);
  }

  const stations = ctx.access.addons.has('advanced_kitchen');
  const lines: PricedLine[] = draft.map((d, i) => ({
    productId: d.product.id,
    categoryId: d.product.categoryId,
    name: d.product.name,
    sku: d.product.sku,
    quantity: d.item.quantity,
    unitPrice: d.unitPrice,
    options: d.options,
    discount: calc.lines[i]!.discount,
    taxRate: d.product.taxRate ?? (settings.tax.taxEnabled ? settings.tax.taxRate : 0),
    tax: calc.lines[i]!.tax,
    total: calc.lines[i]!.total,
    costPrice: d.product.costPrice,
    note: d.item.note,
    sendToKitchen: d.product.sendToKitchen,
    station: stations ? d.station : '',
  }));
  return { settings, lines, calc, pointsDiscount, deliveryFee, total: calc.total + deliveryFee };
}

async function assertRefs(tx: Executor, ctx: BusinessContext, outletId: string, input: OrderInput) {
  if (input.tableId) {
    const [t] = await tx
      .select({ id: diningTables.id })
      .from(diningTables)
      .where(and(eq(diningTables.businessId, ctx.businessId), eq(diningTables.id, input.tableId), eq(diningTables.outletId, outletId)));
    if (!t) throw new AppError('validation_failed', 'Unknown table', { fields: { tableId: { code: 'invalid_option' } } });
  }
  if (input.customerId) {
    const [c] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.businessId, ctx.businessId), eq(customers.id, input.customerId), isNull(customers.deletedAt)));
    if (!c) throw new AppError('validation_failed', 'Unknown customer', { fields: { customerId: { code: 'invalid_option' } } });
  }
}

/** Daily kitchen ticket number per outlet (concurrency-safe counter). */
async function nextTicket(tx: Executor, businessId: string, outletId: string, day: string): Promise<number> {
  const r = await tx.execute<{ last_number: number }>(sql`
    INSERT INTO document_sequences (business_id, scope, doc_type, period, last_number)
    VALUES (${businessId}, ${'outlet:' + outletId}, 'kitchen', ${day}, 1)
    ON CONFLICT (business_id, scope, doc_type, period) DO UPDATE SET last_number = document_sequences.last_number + 1, updated_at = now()
    RETURNING last_number`);
  return Number(r.rows[0]!.last_number);
}

/** Send items to the kitchen display: one ticket per station (stations need the advanced kitchen add-on). */
async function sendToKitchen(tx: Executor, ctx: BusinessContext, sale: { id: string; outletId: string; orderType: string; tableId: string | null; note: string }, lines: PricedLine[]) {
  const kitchenLines = lines.filter((l) => l.sendToKitchen && l.quantity > 0);
  if (!kitchenLines.length || !ctx.access.modules.has('kitchen')) return;
  let tableName: string | null = null;
  if (sale.tableId) {
    const [t] = await tx.select({ name: diningTables.name }).from(diningTables).where(eq(diningTables.id, sale.tableId));
    tableName = t?.name ?? null;
  }
  const day = businessToday(ctx.access.business.timezone);
  const byStation = new Map<string, PricedLine[]>();
  for (const l of kitchenLines) byStation.set(l.station, [...(byStation.get(l.station) ?? []), l]);
  for (const [station, ls] of byStation) {
    await tx.insert(kitchenOrders).values({
      businessId: ctx.businessId,
      outletId: sale.outletId,
      saleId: sale.id,
      ticketNumber: await nextTicket(tx, ctx.businessId, sale.outletId, day),
      orderType: sale.orderType,
      tableName,
      station,
      note: sale.note,
      items: ls.map((l) => ({ name: l.name, quantity: l.quantity, options: l.options.map((o) => o.choice), note: l.note })),
    });
  }
}

function saleValues(priced: Awaited<ReturnType<typeof priceOrder>>) {
  return {
    subtotal: priced.calc.subtotal,
    discount: priced.calc.discount,
    pointsDiscount: priced.pointsDiscount,
    serviceCharge: priced.calc.serviceCharge,
    tax: priced.calc.tax,
    deliveryFee: priced.deliveryFee,
    total: priced.total,
  };
}

async function insertLines(tx: Executor, businessId: string, saleId: string, lines: PricedLine[]) {
  await tx.insert(saleItems).values(
    lines.map((l) => ({
      businessId,
      saleId,
      productId: l.productId,
      categoryId: l.categoryId,
      nameSnapshot: l.name,
      skuSnapshot: l.sku,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      options: l.options,
      discount: l.discount,
      taxRate: l.taxRate,
      tax: l.tax,
      total: l.total,
      costPrice: l.costPrice,
      note: l.note,
      sendToKitchen: l.sendToKitchen,
    })),
  );
}

/** Create an order. Without payments it is held (open, e.g. a running table); with payments it is completed. */
export async function createOrder(db: Executor, ctx: BusinessContext, input: OrderInput, paymentsIn: PaymentsInput | null, req: FastifyRequest) {
  const outletId = requireOutlet(ctx);
  return dbTx(db, async (tx) => {
    await assertRefs(tx, ctx, outletId, input);
    const priced = await priceOrder(tx, ctx, input);
    if (input.orderType === 'dine_in' && priced.settings.pos.requireTableForDineIn && !input.tableId) throw new AppError('table_required');
    const [sale] = await tx
      .insert(sales)
      .values({
        businessId: ctx.businessId,
        outletId,
        status: 'open',
        orderType: input.orderType,
        tableId: input.tableId,
        customerId: input.customerId,
        cashierId: ctx.user.id,
        currency: ctx.access.business.currency,
        note: input.note,
        pointsRedeemed: input.redeemPoints,
        delivery: input.orderType === 'delivery' ? { address: input.delivery?.address ?? '', phone: input.delivery?.phone ?? '' } : null,
        ...saleValues(priced),
      })
      .returning();
    await insertLines(tx, ctx.businessId, sale!.id, priced.lines);
    if (input.sendToKitchen ?? priced.settings.pos.sendToKitchen) await sendToKitchen(tx, ctx, sale!, priced.lines);
    await audit(tx, { ...actor(ctx), action: 'sale.created', entityType: 'sale', entityId: sale!.id, metadata: { total: sale!.total, held: !paymentsIn }, req });
    if (paymentsIn) return completeSale(tx, ctx, sale!.id, paymentsIn, req);
    return sale!;
  });
}

/** Replace the items of an open order (running table). New quantities are sent to the kitchen as a new ticket. */
export async function updateOpenOrder(db: Executor, ctx: BusinessContext, saleId: string, input: OrderInput, req: FastifyRequest) {
  const outletId = requireOutlet(ctx);
  return dbTx(db, async (tx) => {
    const [sale] = await tx
      .select()
      .from(sales)
      .where(and(eq(sales.businessId, ctx.businessId), eq(sales.id, saleId)))
      .for('update');
    if (!sale) throw notFound();
    if (sale.status !== 'open') throw new AppError('document_locked', 'Order is no longer open');
    if (sale.outletId !== outletId) throw new AppError('outlet_mismatch');
    await assertRefs(tx, ctx, outletId, input);
    const before = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));
    const priced = await priceOrder(tx, ctx, input);
    await tx.delete(saleItems).where(eq(saleItems.saleId, saleId));
    await insertLines(tx, ctx.businessId, saleId, priced.lines);
    const [updated] = await tx
      .update(sales)
      .set({
        orderType: input.orderType,
        tableId: input.tableId,
        customerId: input.customerId,
        note: input.note,
        pointsRedeemed: input.redeemPoints,
        delivery: input.orderType === 'delivery' ? { address: input.delivery?.address ?? '', phone: input.delivery?.phone ?? '' } : null,
        ...saleValues(priced),
        updatedAt: new Date(),
      })
      .where(eq(sales.id, saleId))
      .returning();
    // Kitchen receives only the increase per product+options combination.
    const keyOf = (l: { productId: string | null; options: { choice: string }[]; note: string }) => `${l.productId}|${l.options.map((o) => o.choice).join(',')}|${l.note}`;
    const prev = new Map<string, number>();
    for (const b of before) prev.set(keyOf(b), (prev.get(keyOf(b)) ?? 0) + Number(b.quantity));
    const added = priced.lines
      .map((l) => {
        const k = keyOf(l);
        const already = prev.get(k) ?? 0;
        prev.set(k, Math.max(0, already - l.quantity));
        return { ...l, quantity: Math.max(0, l.quantity - already) };
      })
      .filter((l) => l.quantity > 0);
    if (added.length && (input.sendToKitchen ?? priced.settings.pos.sendToKitchen)) await sendToKitchen(tx, ctx, updated!, added);
    await audit(tx, { ...actor(ctx), action: 'sale.updated', entityType: 'sale', entityId: saleId, metadata: { total: updated!.total }, req });
    return updated!;
  });
}

/**
 * Complete (pay) an open sale. Payments are validated against the server total:
 * change is only possible from cash; a remaining balance requires the credit add-on,
 * a customer, the credit permission and room under the customer's credit limit.
 */
export async function completeSale(tx: Executor, ctx: BusinessContext, saleId: string, paymentsIn: PaymentsInput, req: FastifyRequest) {
  const [sale] = await tx
    .select()
    .from(sales)
    .where(and(eq(sales.businessId, ctx.businessId), eq(sales.id, saleId)))
    .for('update');
  if (!sale) throw notFound();
  if (sale.status !== 'open') throw new AppError('document_locked', 'Sale already completed');
  const settings = await loadBusinessSettings(tx, ctx.businessId);

  const tenders = paymentsIn.filter((p) => p.method !== 'credit').map((p) => ({ ...p, amount: toMinor(p.amount) }));
  const wantsCredit = paymentsIn.some((p) => p.method === 'credit');
  const tendered = tenders.reduce((a, p) => a + p.amount, 0);
  const cash = tenders.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0);
  let change = 0;
  let credit = 0;
  if (tendered >= sale.total) {
    change = tendered - sale.total;
    if (change > cash) throw new AppError('payment_exceeds_balance', 'Only cash payments can exceed the total');
    if (wantsCredit) throw new AppError('payment_exceeds_balance', 'Nothing left to put on credit');
  } else {
    if (!wantsCredit) throw new AppError('payment_insufficient', 'Payments do not cover the total', { details: { total: sale.total, tendered } });
    credit = sale.total - tendered;
  }

  if (credit > 0) {
    if (!ctx.access.addons.has('credit')) throw new AppError('addon_not_enabled', 'Credit add-on not enabled', { details: { addon: 'credit' } });
    if (!ctx.permissions.has('credit.create')) throw new AppError('permission_denied', 'Permission denied', { details: { permission: 'credit.create' } });
    if (!sale.customerId) throw new AppError('customer_required', 'Select a customer for a credit sale');
    const customer = await lockCustomer(tx, ctx.businessId, sale.customerId);
    if (!customer) throw notFound();
    if (customer.creditLimit !== null) {
      const outstanding = await totalOutstanding(tx, ctx.businessId, customer.id);
      if (outstanding + credit > customer.creditLimit) {
        throw new AppError('credit_limit_exceeded', 'Credit limit exceeded', { details: { limit: customer.creditLimit, outstanding, requested: credit } });
      }
    }
  }

  const { number } = await allocateDocumentNumber(tx, { businessId: ctx.businessId, docType: 'receipt', numbering: settings.receipt.numbering, outletId: sale.outletId });
  for (const p of tenders) {
    await tx.insert(payments).values({
      businessId: ctx.businessId,
      outletId: sale.outletId,
      customerId: sale.customerId,
      saleId: sale.id,
      kind: 'sale',
      method: p.method,
      amount: p.amount,
      reference: p.reference,
      receivedBy: ctx.user.id,
    });
  }

  // Loyalty: redeem (validated against the locked balance) and earn on the paid total.
  let earned = 0;
  if (sale.customerId && ctx.access.addons.has('loyalty')) {
    const c = await lockCustomer(tx, ctx.businessId, sale.customerId);
    if (c) {
      let balance = c.loyaltyPoints;
      if (sale.pointsRedeemed > 0) {
        if (balance < sale.pointsRedeemed) throw new AppError('points_insufficient');
        balance -= sale.pointsRedeemed;
        await tx.insert(loyaltyTransactions).values({ businessId: ctx.businessId, customerId: c.id, points: -sale.pointsRedeemed, balanceAfter: balance, reason: 'redeem', saleId: sale.id, createdBy: ctx.user.id });
      }
      earned = Math.floor((sale.total / 100) * settings.loyalty.pointsPerUnit);
      if (earned > 0) {
        balance += earned;
        await tx.insert(loyaltyTransactions).values({ businessId: ctx.businessId, customerId: c.id, points: earned, balanceAfter: balance, reason: 'earn', saleId: sale.id, createdBy: ctx.user.id });
      }
      await tx.update(customers).set({ loyaltyPoints: balance }).where(eq(customers.id, c.id));
    }
  } else if (sale.pointsRedeemed > 0) {
    throw new AppError('addon_not_enabled', 'Loyalty add-on not enabled', { details: { addon: 'loyalty' } });
  }

  const [done] = await tx
    .update(sales)
    .set({ status: 'completed', number, paidAmount: tendered, changeAmount: change, balanceDue: credit, pointsEarned: earned, completedAt: new Date(), cashierId: ctx.user.id, updatedAt: new Date() })
    .where(eq(sales.id, sale.id))
    .returning();

  const items = await tx.select({ productId: saleItems.productId, quantity: saleItems.quantity }).from(saleItems).where(eq(saleItems.saleId, sale.id));
  const low = await consumeForSale(tx, {
    businessId: ctx.businessId,
    outletId: sale.outletId,
    saleId: sale.id,
    userId: ctx.user.id,
    lines: items.filter((i) => i.productId).map((i) => ({ productId: i.productId!, quantity: Number(i.quantity) })),
    useRecipes: ctx.access.addons.has('recipes'),
    allowNegative: settings.pos.allowNegativeStock,
  });
  await notifyLowStock(tx, ctx.businessId, low);
  await audit(tx, { ...actor(ctx), action: 'sale.completed', entityType: 'sale', entityId: sale.id, metadata: { number, total: sale.total, credit }, req });
  return done!;
}

/** Void a sale: reverses stock, payments and loyalty. Sales with collected credit payments must be settled first. */
export async function voidSale(db: Executor, ctx: BusinessContext, saleId: string, reason: string, req: FastifyRequest) {
  return dbTx(db, async (tx) => {
    const [sale] = await tx
      .select()
      .from(sales)
      .where(and(eq(sales.businessId, ctx.businessId), eq(sales.id, saleId)))
      .for('update');
    if (!sale) throw notFound();
    if (sale.status === 'void') throw new AppError('invalid_status_transition', 'Already void');
    const creditPayments = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.saleId, saleId), eq(payments.kind, 'credit_payment'), isNull(payments.voidedAt)));
    if (creditPayments.length) throw new AppError('invalid_status_transition', 'Credit payments were received for this sale');

    if (sale.status === 'completed') {
      const items = await tx.select({ productId: saleItems.productId, quantity: saleItems.quantity }).from(saleItems).where(eq(saleItems.saleId, saleId));
      await consumeForSale(tx, {
        businessId: ctx.businessId,
        outletId: sale.outletId,
        saleId,
        userId: ctx.user.id,
        lines: items.filter((i) => i.productId).map((i) => ({ productId: i.productId!, quantity: Number(i.quantity) })),
        useRecipes: ctx.access.addons.has('recipes'),
        allowNegative: true,
        reverse: true,
      });
      await tx.update(payments).set({ voidedAt: new Date() }).where(eq(payments.saleId, saleId));
      if (sale.customerId && (sale.pointsEarned || sale.pointsRedeemed)) {
        const c = await lockCustomer(tx, ctx.businessId, sale.customerId);
        if (c) {
          const delta = sale.pointsRedeemed - sale.pointsEarned;
          const balance = c.loyaltyPoints + delta;
          await tx.update(customers).set({ loyaltyPoints: balance }).where(eq(customers.id, c.id));
          await tx.insert(loyaltyTransactions).values({ businessId: ctx.businessId, customerId: c.id, points: delta, balanceAfter: balance, reason: 'void', saleId, createdBy: ctx.user.id });
        }
      }
    }
    await tx
      .update(kitchenOrders)
      .set({ status: 'completed', completedAt: new Date() })
      .where(and(eq(kitchenOrders.saleId, saleId), sql`${kitchenOrders.status} <> 'completed'`));
    const [v] = await tx
      .update(sales)
      .set({ status: 'void', balanceDue: 0, voidReason: reason, voidedBy: ctx.user.id, voidedAt: new Date(), updatedAt: new Date() })
      .where(eq(sales.id, saleId))
      .returning();
    await audit(tx, { ...actor(ctx), action: 'sale.voided', entityType: 'sale', entityId: saleId, metadata: { reason, number: sale.number }, req });
    return v!;
  });
}

/** Receive a credit payment from a customer; applied to the oldest credit sales first (FIFO). */
export async function receiveCreditPayment(
  db: Executor,
  ctx: BusinessContext,
  customerId: string,
  input: { amount: number; method: string; reference: string; notes: string },
  req: FastifyRequest,
) {
  return dbTx(db, async (tx) => {
    const customer = await lockCustomer(tx, ctx.businessId, customerId);
    if (!customer) throw notFound();
    const open = await tx
      .select({ id: sales.id, balanceDue: sales.balanceDue, outletId: sales.outletId })
      .from(sales)
      .where(and(eq(sales.businessId, ctx.businessId), eq(sales.customerId, customerId), eq(sales.status, 'completed'), sql`${sales.balanceDue} > 0`))
      .orderBy(asc(sales.completedAt))
      .for('update');
    const due = open.reduce((a, s) => a + s.balanceDue, 0);
    let remaining = toMinor(input.amount);
    if (remaining > due) throw new AppError('payment_exceeds_balance', 'Payment exceeds the outstanding credit balance', { details: { due } });
    for (const s of open) {
      if (remaining <= 0) break;
      const applied = Math.min(remaining, s.balanceDue);
      remaining -= applied;
      await tx.update(sales).set({ balanceDue: s.balanceDue - applied, updatedAt: new Date() }).where(eq(sales.id, s.id));
      await tx.insert(payments).values({
        businessId: ctx.businessId,
        outletId: s.outletId,
        customerId,
        saleId: s.id,
        kind: 'credit_payment',
        method: input.method,
        amount: applied,
        reference: input.reference,
        notes: input.notes,
        receivedBy: ctx.user.id,
      });
    }
    await audit(tx, { ...actor(ctx), action: 'credit.payment_received', entityType: 'customer', entityId: customerId, metadata: { amount: toMinor(input.amount) }, req });
    await notifyPermission(tx, ctx.businessId, 'credit.view', 'notify.credit_payment', { customer: customer.name, amount: toMinor(input.amount) }, `/customers/${customerId}`);
    return { applied: toMinor(input.amount), remainingDue: due - toMinor(input.amount) };
  });
}

/** Run in a transaction unless already inside one. */
async function dbTx<T>(db: Executor, fn: (tx: Executor) => Promise<T>): Promise<T> {
  if ('transaction' in db && typeof (db as { transaction?: unknown }).transaction === 'function' && !('rollback' in db)) {
    return (db as unknown as { transaction: (f: (tx: Executor) => Promise<T>) => Promise<T> }).transaction(fn);
  }
  return fn(db);
}
