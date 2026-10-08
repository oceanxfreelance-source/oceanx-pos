import { and, desc, eq, sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { billingPayments, businesses, plans, subscriptions, superAdmins, users } from '../db/schema';
import { AppError, notFound } from '../lib/errors';

/** Calendar months after `from` (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** A plan a business can pay for: active, public, with a price. Amount is in minor units. */
export async function payablePlan(db: Executor, planId: string, months: number) {
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
  if (!plan || !plan.isActive || !plan.isPublic || Number(plan.priceMonthly) <= 0) {
    throw new AppError('validation_failed', 'Choose a paid plan', { fields: { planId: { code: 'invalid_option' } } });
  }
  return { plan, amount: Math.round(Number(plan.priceMonthly) * 100) * months, currency: plan.currency };
}

async function nextReceiptNumber(tx: Executor, at: Date) {
  // One platform-wide sequence per year; the advisory lock serialises concurrent approvals.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('billing_receipt'))`);
  const year = at.getUTCFullYear();
  const prefix = `OXR-${year}-`;
  const res = await tx.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM billing_payments WHERE receipt_number LIKE ${prefix + '%'}`);
  return `${prefix}${String(Number(res.rows[0]?.n ?? 0) + 1).padStart(5, '0')}`;
}

/**
 * Approve a payment: the subscription moves to the paid plan and its end date moves forward by the months paid,
 * counted from today or from the current end date if that is still in the future (nobody loses paid/trial days).
 */
export async function approvePayment(tx: Executor, paymentId: string, adminId: string, note = '') {
  const [p] = await tx.select().from(billingPayments).where(eq(billingPayments.id, paymentId)).for('update');
  if (!p) throw notFound();
  if (p.status !== 'pending') throw new AppError('invalid_status_transition', 'Payment already reviewed');
  const now = new Date();
  const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.businessId, p.businessId)).for('update');
  const start = sub && sub.currentPeriodEnd > now && sub.status !== 'cancelled' ? sub.currentPeriodEnd : now;
  const end = addMonths(start, p.months);
  if (sub) {
    await tx.update(subscriptions).set({ planId: p.planId, status: 'active', currentPeriodEnd: end, updatedAt: now }).where(eq(subscriptions.id, sub.id));
  } else {
    await tx.insert(subscriptions).values({ businessId: p.businessId, planId: p.planId, status: 'active', startsAt: now, currentPeriodEnd: end });
  }
  const receiptNumber = await nextReceiptNumber(tx, now);
  const [u] = await tx
    .update(billingPayments)
    .set({ status: 'approved', reviewedBy: adminId, reviewedAt: now, reviewNote: note, periodStart: start, periodEnd: end, receiptNumber, updatedAt: now })
    .where(eq(billingPayments.id, paymentId))
    .returning();
  return u!;
}

/** Payments with the names needed on screen (business, plan, who submitted / reviewed). */
export async function listPayments(db: Executor, where: { businessId?: string; status?: string }, limit = 200) {
  const conds = [];
  if (where.businessId) conds.push(eq(billingPayments.businessId, where.businessId));
  if (where.status) conds.push(eq(billingPayments.status, where.status));
  const rows = await db
    .select({
      p: billingPayments,
      businessName: businesses.name,
      planName: plans.name,
      submittedByName: users.name,
      reviewedByName: superAdmins.name,
    })
    .from(billingPayments)
    .innerJoin(businesses, eq(businesses.id, billingPayments.businessId))
    .innerJoin(plans, eq(plans.id, billingPayments.planId))
    .leftJoin(users, eq(users.id, billingPayments.submittedByUser))
    .leftJoin(superAdmins, eq(superAdmins.id, sql`COALESCE(${billingPayments.reviewedBy}, ${billingPayments.recordedByAdmin})`))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(billingPayments.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.p.id,
    businessId: r.p.businessId,
    businessName: r.businessName,
    planId: r.p.planId,
    planName: r.planName,
    months: r.p.months,
    amount: r.p.amount,
    currency: r.p.currency,
    method: r.p.method,
    reference: r.p.reference,
    hasSlip: !!r.p.slipPath,
    status: r.p.status,
    receiptNumber: r.p.receiptNumber,
    reviewNote: r.p.reviewNote,
    submittedBy: r.submittedByName,
    reviewedBy: r.reviewedByName,
    reviewedAt: r.p.reviewedAt,
    periodStart: r.p.periodStart,
    periodEnd: r.p.periodEnd,
    createdAt: r.p.createdAt,
  }));
}
