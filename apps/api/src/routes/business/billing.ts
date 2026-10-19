import type { FastifyInstance } from 'fastify';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { billingSubmitSchema, PAYDAY_OF_MONTH } from '@oceanx/shared';
import { billingPayments, plans, subscriptions } from '../../db/schema';
import { bizCtx } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { contentTypeFor } from '../../lib/storage';
import { actor, businessToday } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import { listPayments, payablePlan } from '../../services/billing';
import { getPlatformSettings, type PlatformSettings } from '../../services/platformSettings';

/**
 * The business's own subscription billing: plan, end date, the platform's bank details, and "I've paid"
 * with a transfer slip. These routes stay open when the trial/subscription has ended (that is when they matter).
 */
export async function billingRoutes(app: FastifyInstance) {
  const { db, storage } = app.deps;
  const open = { config: { sessionOnly: true } };
  const canPay = (ctx: ReturnType<typeof bizCtx>) => ctx.user.isOwner || ctx.permissions.has('settings.manage');

  /** The next salary day from today (YYYY-MM-DD): the 30th, or the month's last day when it is shorter. */
  function nextPayday(today: string) {
    const [y, m, d] = today.split('-').map(Number) as [number, number, number];
    const payday = (year: number, month: number) => {
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(PAYDAY_OF_MONTH, last)).padStart(2, '0')}`;
    };
    const thisMonth = payday(y, m);
    return today <= thisMonth ? thisMonth : m === 12 ? payday(y + 1, 1) : payday(y, m + 1);
  }

  /**
   * Gravity Budget "pay on salary day" (an offer Super Admin turns on and off): any customer may choose, once,
   * to keep using the app until salary day (the 30th) and pay then. "chosen" is that date while the payment is still to come.
   */
  async function paydayInfo(ctx: ReturnType<typeof bizCtx>, settings: PlatformSettings) {
    const [row] = await db
      .select({
        date: subscriptions.paydayDate,
        status: subscriptions.status,
        paidSince: sql<boolean>`EXISTS (SELECT 1 FROM ${billingPayments} p WHERE p.business_id = ${ctx.businessId} AND p.status = 'approved' AND p.reviewed_at > ${subscriptions.paydayChosenAt})`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.businessId, ctx.businessId));
    const offerOn = ctx.access.business.product === 'budget' && settings.budgetPaydayOn;
    const available = offerOn && !!row && row.status !== 'cancelled' && !row.date && canPay(ctx);
    const today = businessToday(ctx.access.business.timezone);
    return { available, today, date: nextPayday(today), chosen: row?.date && !row.paidSince ? row.date : null };
  }

  app.get('/billing', open, async (req) => {
    const ctx = bizCtx(req);
    const [settings, planRows, payments] = await Promise.all([
      getPlatformSettings(db),
      db
        .select({ id: plans.id, code: plans.code, name: plans.name, description: plans.description, priceMonthly: plans.priceMonthly, currency: plans.currency, limits: plans.limits })
        .from(plans)
        .where(and(eq(plans.isActive, true), eq(plans.isPublic, true), gt(plans.priceMonthly, '0'), eq(plans.product, ctx.access.business.product)))
        .orderBy(asc(plans.sortOrder)),
      listPayments(db, { businessId: ctx.businessId }, 50),
    ]);
    const payday = await paydayInfo(ctx, settings);
    const sub = ctx.access.subscription;
    const msLeft = sub ? sub.currentPeriodEnd.getTime() - Date.now() : 0;
    const daysLeft = sub ? Math.ceil(msLeft / 86_400_000) : null;
    // Short trials (hours or minutes) are shown as time left.
    const minutesLeft = sub ? Math.max(0, Math.ceil(msLeft / 60_000)) : null;
    return {
      canPay: canPay(ctx),
      state: ctx.access.state,
      subscription: sub && { planId: sub.planId, planName: sub.planName, planCode: sub.planCode, status: sub.status, effectiveStatus: sub.effectiveStatus, currentPeriodEnd: sub.currentPeriodEnd, daysLeft, minutesLeft },
      reminderDays: settings.billingReminderDays,
      bankDetails: settings.billingBankDetails,
      note: settings.billingNote,
      plans: planRows.map((p) => ({ ...p, priceMonthly: Math.round(Number(p.priceMonthly) * 100) })),
      payments: payments.map(({ businessName: _b, ...p }) => p),
      payday,
    };
  });

  /** "I'll pay on salary day": the app keeps working until two days after the 30th. Once per account. */
  app.post('/billing/payday', open, async (req) => {
    const ctx = bizCtx(req);
    const info = await paydayInfo(ctx, await getPlatformSettings(db));
    if (!info.available) throw new AppError('forbidden', 'Pay on salary day is not available');
    const date = info.date;
    const tz = ctx.access.business.timezone;
    // Until the end of the second day after salary day, in the customer's time zone.
    const [r] = await db.execute<{ end: Date }>(sql`SELECT ((${date}::date + 3)::timestamp AT TIME ZONE ${tz}) AS end`).then((x) => x.rows);
    const end = new Date(r!.end);
    // A paid month that already lasts beyond salary day is not shortened.
    const [u] = await db
      .update(subscriptions)
      .set({ paydayDate: date, paydayChosenAt: new Date(), currentPeriodEnd: sql`GREATEST(${subscriptions.currentPeriodEnd}, ${end})`, updatedAt: new Date() })
      .where(and(eq(subscriptions.businessId, ctx.businessId), sql`${subscriptions.status} <> 'cancelled'`, sql`${subscriptions.paydayDate} IS NULL`))
      .returning({ id: subscriptions.id });
    if (!u) throw new AppError('conflict', 'Already chosen');
    await audit(db, { ...actor(ctx), action: 'billing.payday_chosen', entityType: 'subscription', entityId: u.id, metadata: { date }, req });
    return { date, currentPeriodEnd: end };
  });

  // "I've paid": plan + months + reference in the query, the slip (JPG/PNG/WebP/PDF) as the raw body.
  app.post('/billing/payments', { ...open, bodyLimit: 5_242_880 }, async (req, reply) => {
    const ctx = bizCtx(req);
    if (!canPay(ctx)) throw new AppError('permission_denied', 'Only the owner or a manager can pay');
    const q = parse(billingSubmitSchema, req.query);
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new AppError('validation_failed', 'Slip required', { fields: { file: { code: 'invalid_image' } } });
    const [pending] = await db
      .select({ id: billingPayments.id })
      .from(billingPayments)
      .where(and(eq(billingPayments.businessId, ctx.businessId), eq(billingPayments.status, 'pending')));
    if (pending) throw new AppError('conflict', 'A payment is already waiting for review');
    const { plan, amount, currency } = await payablePlan(db, q.planId, q.months, ctx.access.business.product);
    const saved = await storage.saveBusinessDocument(ctx.businessId, 'billing-slip', req.body);
    const [p] = await db
      .insert(billingPayments)
      .values({ businessId: ctx.businessId, planId: plan.id, months: q.months, amount, currency, method: 'bank_transfer', reference: q.reference, slipPath: saved.rel, status: 'pending', submittedByUser: ctx.user.id })
      .returning();
    await audit(db, { ...actor(ctx), action: 'billing.slip_submitted', entityType: 'billing_payment', entityId: p!.id, metadata: { plan: plan.code, months: q.months, amount, currency }, req });
    return reply.code(201).send({ id: p!.id, status: p!.status });
  });

  app.get('/billing/payments/:id/slip', open, async (req, reply) => {
    const ctx = bizCtx(req);
    const [p] = await db
      .select({ slipPath: billingPayments.slipPath })
      .from(billingPayments)
      .where(and(eq(billingPayments.id, idParam(req)), eq(billingPayments.businessId, ctx.businessId)));
    if (!p?.slipPath) throw notFound();
    reply.header('content-type', contentTypeFor(p.slipPath)).header('content-disposition', 'inline').header('x-content-type-options', 'nosniff').header('cache-control', 'private, no-store');
    return reply.send(await storage.read(p.slipPath));
  });
}
