import type { FastifyRequest } from 'fastify';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { refundSchema } from '@oceanx/shared';
import type { Executor } from '../../db/client';
import { payments, saleItems, saleRefundItems, saleRefunds, sales } from '../../db/schema';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { actor, round3 } from '../../lib/tenant';
import type { BusinessContext } from '../../types';
import { allocateDocumentNumber } from '../sequences';
import { consumeForSale } from './inventory';

type RefundInput = z.output<typeof refundSchema>;

/** Refund numbers: RF-2026-00001, one series per business. */
const REFUND_NUMBERING = { prefix: 'RF', startNumber: 1, padding: 5, format: '{PREFIX}-{YYYY}-{SEQ}', reset: 'never' } as const;

/** Quantities already refunded per sale line. */
export async function refundedQuantities(db: Executor, businessId: string, saleId: string): Promise<Map<string, number>> {
  const rows = await db.execute<{ sale_item_id: string; q: string }>(sql`
    SELECT ri.sale_item_id, SUM(ri.quantity)::text AS q FROM sale_refund_items ri JOIN sale_refunds r ON r.id = ri.refund_id
    WHERE r.business_id = ${businessId} AND r.sale_id = ${saleId} GROUP BY ri.sale_item_id`);
  return new Map(rows.rows.map((r) => [r.sale_item_id, Number(r.q)]));
}

/**
 * Give money back for some or all items of a completed, fully paid bill.
 *
 * Each refunded line returns its share of what the customer paid for it (incl. tax). Service charge,
 * delivery fee and any points discount follow the same share of the bill, so refunding everything returns
 * exactly the bill total. Optionally the items go back into stock. The refund is recorded as a negative
 * payment (so takings by payment method stay right) and its tax reduces output GST.
 */
export async function refundSale(db: Executor, ctx: BusinessContext, saleId: string, input: RefundInput, req: FastifyRequest) {
  return dbTx(db, async (tx) => {
    const [sale] = await tx
      .select()
      .from(sales)
      .where(and(eq(sales.businessId, ctx.businessId), eq(sales.id, saleId)))
      .for('update');
    if (!sale) throw notFound();
    if (sale.status !== 'completed') throw new AppError('invalid_status_transition', 'Only completed bills can be refunded');
    if (sale.balanceDue > 0) throw new AppError('invalid_status_transition', 'This bill is not fully paid');

    const items = await tx.select().from(saleItems).where(and(eq(saleItems.businessId, ctx.businessId), eq(saleItems.saleId, saleId)));
    const done = await refundedQuantities(tx, ctx.businessId, saleId);

    const want = new Map<string, number>();
    for (const r of input.items) want.set(r.saleItemId, round3((want.get(r.saleItemId) ?? 0) + r.quantity));
    const lines: { item: (typeof items)[number]; quantity: number; total: number; tax: number }[] = [];
    for (const [saleItemId, quantity] of want) {
      const item = items.find((i) => i.id === saleItemId);
      if (!item) throw new AppError('validation_failed', 'Item is not on this bill', { fields: { items: { code: 'invalid' } } });
      const left = round3(Number(item.quantity) - (done.get(item.id) ?? 0));
      if (quantity > left + 1e-9) {
        throw new AppError('validation_failed', 'More than was sold', { fields: { items: { code: 'too_big', params: { max: left } } }, details: { saleItemId, left } });
      }
      const share = quantity / Number(item.quantity);
      lines.push({ item, quantity, total: Math.round(item.total * share), tax: Math.round(item.tax * share) });
    }

    // Is everything on the bill now returned? Then give back exactly what is left of the bill.
    const allBack = items.every((i) => round3(Number(i.quantity) - (done.get(i.id) ?? 0) - (want.get(i.id) ?? 0)) <= 0);
    const itemsTotal = items.reduce((a, i) => a + i.total, 0);
    const itemsTax = items.reduce((a, i) => a + i.tax, 0);
    const lineTotal = lines.reduce((a, l) => a + l.total, 0);
    const lineTax = lines.reduce((a, l) => a + l.tax, 0);
    const [prev] = await tx
      .select({ tax: sql<string>`COALESCE(SUM(${saleRefunds.tax}),0)::text` })
      .from(saleRefunds)
      .where(and(eq(saleRefunds.businessId, ctx.businessId), eq(saleRefunds.saleId, saleId)));
    const refundedTax = Number(prev?.tax ?? 0);
    let total: number;
    let tax: number;
    if (allBack) {
      total = sale.total - sale.refundedTotal;
      tax = sale.tax - refundedTax;
    } else {
      const ratio = itemsTotal > 0 ? lineTotal / itemsTotal : 0;
      // Delivery fee is only returned with the last item.
      total = Math.round((sale.total - sale.deliveryFee) * ratio);
      tax = lineTax + Math.round((sale.tax - itemsTax) * ratio);
      total = Math.min(total, sale.total - sale.refundedTotal);
      tax = Math.min(tax, sale.tax - refundedTax);
    }
    if (total <= 0) throw new AppError('validation_failed', 'Nothing to refund', { fields: { items: { code: 'too_small' } } });

    const { number } = await allocateDocumentNumber(tx, { businessId: ctx.businessId, docType: 'credit_note', numbering: REFUND_NUMBERING });
    const [refund] = await tx
      .insert(saleRefunds)
      .values({ businessId: ctx.businessId, outletId: sale.outletId, saleId, number, reason: input.reason, method: input.method, total, tax, restocked: input.restock, createdBy: ctx.user.id })
      .returning();
    await tx.insert(saleRefundItems).values(
      lines.map((l) => ({
        businessId: ctx.businessId,
        refundId: refund!.id,
        saleItemId: l.item.id,
        nameSnapshot: l.item.nameSnapshot,
        quantity: l.quantity,
        taxRate: l.item.taxRate,
        net: l.total - l.tax,
        tax: l.tax,
      })),
    );
    await tx.insert(payments).values({
      businessId: ctx.businessId,
      outletId: sale.outletId,
      customerId: sale.customerId,
      saleId,
      kind: 'refund',
      method: input.method,
      amount: -total,
      reference: number,
      notes: input.reason,
      receivedBy: ctx.user.id,
    });
    await tx
      .update(sales)
      .set({ refundedTotal: sale.refundedTotal + total, updatedAt: new Date() })
      .where(eq(sales.id, saleId));

    if (input.restock) {
      const productLines = lines.filter((l) => l.item.productId).map((l) => ({ productId: l.item.productId!, quantity: l.quantity }));
      await consumeForSale(tx, {
        businessId: ctx.businessId,
        outletId: sale.outletId,
        saleId,
        userId: ctx.user.id,
        lines: productLines,
        useRecipes: ctx.access.addons.has('recipes'),
        allowNegative: true,
        reverse: true,
      });
    }
    await audit(tx, { ...actor(ctx), action: 'sale.refunded', entityType: 'sale', entityId: saleId, metadata: { number: sale.number, refund: number, total, restock: input.restock }, req });
    return { ...refund!, items: lines.map((l) => ({ saleItemId: l.item.id, name: l.item.nameSnapshot, quantity: l.quantity, amount: l.total })) };
  });
}

/** Refunds of one bill, newest first, with their lines. */
export async function listRefunds(db: Executor, businessId: string, saleId: string) {
  const refunds = await db
    .select()
    .from(saleRefunds)
    .where(and(eq(saleRefunds.businessId, businessId), eq(saleRefunds.saleId, saleId)))
    .orderBy(sql`${saleRefunds.createdAt} DESC`);
  if (!refunds.length) return [];
  const lines = await db
    .select()
    .from(saleRefundItems)
    .where(
      inArray(
        saleRefundItems.refundId,
        refunds.map((r) => r.id),
      ),
    );
  return refunds.map((r) => ({ ...r, items: lines.filter((l) => l.refundId === r.id) }));
}

/** Run in a transaction unless already inside one. */
async function dbTx<T>(db: Executor, fn: (tx: Executor) => Promise<T>): Promise<T> {
  if ('transaction' in db && typeof (db as { transaction?: unknown }).transaction === 'function' && !('rollback' in db)) {
    return (db as unknown as { transaction: (f: (tx: Executor) => Promise<T>) => Promise<T> }).transaction(fn);
  }
  return fn(db);
}
