import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Executor } from '../../db/client';
import { customers, invoices, sales } from '../../db/schema';

/**
 * Customer outstanding balance — ONE source of truth shared by POS credit sales and invoices:
 *   Σ completed credit-sale balances + Σ open invoice balances.
 * Payments reduce those balances on the documents themselves, so there is no separate ledger to drift.
 */
export async function outstandingFor(db: Executor, businessId: string, customerIds: string[]): Promise<Map<string, { sales: number; invoices: number; overdue: number }>> {
  const out = new Map<string, { sales: number; invoices: number; overdue: number }>();
  if (!customerIds.length) return out;
  for (const id of customerIds) out.set(id, { sales: 0, invoices: 0, overdue: 0 });
  const saleRows = await db
    .select({ customerId: sales.customerId, due: sql<string>`COALESCE(SUM(${sales.balanceDue}), 0)` })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), eq(sales.status, 'completed'), inArray(sales.customerId, customerIds)))
    .groupBy(sales.customerId);
  for (const r of saleRows) if (r.customerId) out.get(r.customerId)!.sales = Number(r.due);
  const invRows = await db
    .select({
      customerId: invoices.customerId,
      due: sql<string>`COALESCE(SUM(${invoices.balanceDue}), 0)`,
      overdue: sql<string>`COALESCE(SUM(${invoices.balanceDue}) FILTER (WHERE ${invoices.dueDate} < to_char(now(), 'YYYY-MM-DD')), 0)`,
    })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), inArray(invoices.status, ['issued', 'partially_paid']), inArray(invoices.customerId, customerIds)))
    .groupBy(invoices.customerId);
  for (const r of invRows) {
    const o = out.get(r.customerId)!;
    o.invoices = Number(r.due);
    o.overdue = Number(r.overdue);
  }
  return out;
}

export async function totalOutstanding(db: Executor, businessId: string, customerId: string): Promise<number> {
  const o = (await outstandingFor(db, businessId, [customerId])).get(customerId)!;
  return o.sales + o.invoices;
}

/** Lock the customer row to serialize credit-limit checks for concurrent sales. */
export async function lockCustomer(db: Executor, businessId: string, customerId: string) {
  const [c] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.businessId, businessId), eq(customers.id, customerId), sql`${customers.deletedAt} IS NULL`))
    .for('update');
  return c ?? null;
}
