import type { FastifyInstance } from 'fastify';
import { and, asc, eq, gt } from 'drizzle-orm';
import { billingSubmitSchema } from '@oceanx/shared';
import { billingPayments, plans } from '../../db/schema';
import { bizCtx } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { contentTypeFor } from '../../lib/storage';
import { actor } from '../../lib/tenant';
import { parse } from '../../lib/validation';
import { listPayments, payablePlan } from '../../services/billing';
import { getPlatformSettings } from '../../services/platformSettings';

/**
 * The business's own subscription billing: plan, end date, the platform's bank details, and "I've paid"
 * with a transfer slip. These routes stay open when the trial/subscription has ended (that is when they matter).
 */
export async function billingRoutes(app: FastifyInstance) {
  const { db, storage } = app.deps;
  const open = { config: { sessionOnly: true } };
  const canPay = (ctx: ReturnType<typeof bizCtx>) => ctx.user.isOwner || ctx.permissions.has('settings.manage');

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
    const sub = ctx.access.subscription;
    const daysLeft = sub ? Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86_400_000) : null;
    return {
      canPay: canPay(ctx),
      state: ctx.access.state,
      subscription: sub && { planId: sub.planId, planName: sub.planName, planCode: sub.planCode, status: sub.status, effectiveStatus: sub.effectiveStatus, currentPeriodEnd: sub.currentPeriodEnd, daysLeft },
      reminderDays: settings.billingReminderDays,
      bankDetails: settings.billingBankDetails,
      note: settings.billingNote,
      plans: planRows.map((p) => ({ ...p, priceMonthly: Math.round(Number(p.priceMonthly) * 100) })),
      payments: payments.map(({ businessName: _b, ...p }) => p),
    };
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
