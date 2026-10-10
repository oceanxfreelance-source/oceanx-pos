import type { FastifyInstance } from 'fastify';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { billingRecordSchema, billingRejectSchema, billingReviewSchema, PRODUCTS } from '@oceanx/shared';
import { billingPayments, businesses } from '../../db/schema';
import { saCtx } from '../../guards/superadmin';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { contentTypeFor } from '../../lib/storage';
import { parse } from '../../lib/validation';
import { approvePayment, listPayments, payablePlan } from '../../services/billing';

/** Subscription payments: review uploaded transfer slips, record cash/card payments, see what came in. */
export async function billingAdminRoutes(app: FastifyInstance) {
  const { db, storage } = app.deps;
  const saAudit = (ctx: ReturnType<typeof saCtx>) => ({ actorType: 'super_admin' as const, actorId: ctx.admin.id, actorName: ctx.admin.name });

  app.get('/billing/payments', async (req) => {
    const q = parse(z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional(), businessId: z.uuid().optional(), product: z.enum(PRODUCTS).optional() }), req.query);
    return { items: await listPayments(db, q) };
  });

  app.get('/billing/summary', async (req) => {
    const q = parse(z.object({ product: z.enum(PRODUCTS).optional() }), req.query);
    const byProduct = q.product ? sql`${billingPayments.businessId} IN (SELECT id FROM businesses WHERE product = ${q.product})` : undefined;
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const [pending, received] = await Promise.all([
      db.select({ n: count() }).from(billingPayments).where(and(eq(billingPayments.status, 'pending'), byProduct)),
      db
        .select({ currency: billingPayments.currency, total: sql<string>`sum(${billingPayments.amount})::text`, n: count() })
        .from(billingPayments)
        .where(and(eq(billingPayments.status, 'approved'), gte(billingPayments.reviewedAt, monthStart), byProduct))
        .groupBy(billingPayments.currency),
    ]);
    return { pending: pending[0]?.n ?? 0, receivedThisMonth: received.map((r) => ({ currency: r.currency, total: Number(r.total), count: r.n })) };
  });

  app.get('/billing/payments/:id/slip', async (req, reply) => {
    const [p] = await db.select({ slipPath: billingPayments.slipPath }).from(billingPayments).where(eq(billingPayments.id, idParam(req)));
    if (!p?.slipPath) throw notFound();
    reply.header('content-type', contentTypeFor(p.slipPath)).header('content-disposition', 'inline').header('x-content-type-options', 'nosniff').header('cache-control', 'private, no-store');
    return reply.send(await storage.read(p.slipPath));
  });

  app.post('/billing/payments/:id/approve', async (req) => {
    const ctx = saCtx(req);
    const { note } = parse(billingReviewSchema, req.body ?? {});
    const id = idParam(req);
    return db.transaction(async (tx) => {
      const p = await approvePayment(tx, id, ctx.admin.id, note);
      await audit(tx, { ...saAudit(ctx), action: 'billing.payment_approved', entityType: 'billing_payment', entityId: id, businessId: p.businessId, metadata: { receipt: p.receiptNumber, months: p.months, until: p.periodEnd?.toISOString() }, req });
      return p;
    });
  });

  app.post('/billing/payments/:id/reject', async (req) => {
    const ctx = saCtx(req);
    const { note } = parse(billingRejectSchema, req.body);
    const id = idParam(req);
    return db.transaction(async (tx) => {
      const [p] = await tx.select().from(billingPayments).where(eq(billingPayments.id, id)).for('update');
      if (!p) throw notFound();
      if (p.status !== 'pending') throw new AppError('invalid_status_transition', 'Payment already reviewed');
      const [u] = await tx
        .update(billingPayments)
        .set({ status: 'rejected', reviewedBy: ctx.admin.id, reviewedAt: new Date(), reviewNote: note, updatedAt: new Date() })
        .where(eq(billingPayments.id, id))
        .returning();
      await audit(tx, { ...saAudit(ctx), action: 'billing.payment_rejected', entityType: 'billing_payment', entityId: id, businessId: p.businessId, metadata: { note }, req });
      return u;
    });
  });

  // Payment taken by the team directly (cash at the restaurant, card machine…): recorded and approved at once.
  app.post('/businesses/:id/billing/payments', async (req, reply) => {
    const ctx = saCtx(req);
    const businessId = idParam(req);
    const body = parse(billingRecordSchema, req.body);
    const [b] = await db.select({ id: businesses.id, product: businesses.product }).from(businesses).where(eq(businesses.id, businessId));
    if (!b) throw notFound();
    const { plan, amount, currency } = await payablePlan(db, body.planId, body.months, b.product);
    const p = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(billingPayments)
        .values({
          businessId,
          planId: plan.id,
          months: body.months,
          amount: body.amount !== undefined ? Math.round(body.amount * 100) : amount,
          currency,
          method: body.method,
          reference: body.reference,
          status: 'pending',
          recordedByAdmin: ctx.admin.id,
        })
        .returning();
      const approved = await approvePayment(tx, row!.id, ctx.admin.id);
      await audit(tx, { ...saAudit(ctx), action: 'billing.payment_recorded', entityType: 'billing_payment', entityId: row!.id, businessId, metadata: { method: body.method, receipt: approved.receiptNumber, months: body.months }, req });
      return approved;
    });
    return reply.code(201).send(p);
  });
}
