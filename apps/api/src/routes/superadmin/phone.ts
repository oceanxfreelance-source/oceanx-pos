import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { billingPayments, businesses, superAdminAlertKeys, superAdmins } from '../../db/schema';
import { saCtx } from '../../guards/superadmin';
import { audit } from '../../lib/audit';
import { hashToken, randomToken } from '../../lib/crypto';
import { AppError, notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { parse } from '../../lib/validation';

/** How often a phone's "last used" time is written (it checks every 15 minutes). */
const LAST_USED_WRITE_MS = 10 * 60_000;

async function pendingPayments(db: FastifyInstance['deps']['db']) {
  const [[n], [newest]] = await Promise.all([
    db.select({ n: count() }).from(billingPayments).where(eq(billingPayments.status, 'pending')),
    db
      .select({ id: billingPayments.id, amount: billingPayments.amount, currency: billingPayments.currency, createdAt: billingPayments.createdAt, businessName: businesses.name, product: businesses.product })
      .from(billingPayments)
      .innerJoin(businesses, eq(businesses.id, billingPayments.businessId))
      .where(eq(billingPayments.status, 'pending'))
      .orderBy(desc(billingPayments.createdAt))
      .limit(1),
  ]);
  return { pending: n?.n ?? 0, newest: newest ?? null };
}

/**
 * OceanX Admin phone app, the part that needs no sign-in: the phone asks, in the background, whether payments
 * wait for approval, using its own alert key (header x-alert-key). It can read only this.
 */
export async function superAdminPhonePublicRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  app.get('/alerts/pending', async (req) => {
    const key = req.headers['x-alert-key'];
    if (typeof key !== 'string' || key.length < 20) throw new AppError('unauthenticated', 'Alert key required');
    const [row] = await db
      .select({ id: superAdminAlertKeys.id, lastUsedAt: superAdminAlertKeys.lastUsedAt, active: superAdmins.isActive })
      .from(superAdminAlertKeys)
      .innerJoin(superAdmins, eq(superAdmins.id, superAdminAlertKeys.superAdminId))
      .where(and(eq(superAdminAlertKeys.tokenHash, hashToken(key)), isNull(superAdminAlertKeys.revokedAt)));
    if (!row || !row.active) throw new AppError('unauthenticated', 'Alert key not valid');
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_WRITE_MS) {
      await db.update(superAdminAlertKeys).set({ lastUsedAt: new Date() }).where(eq(superAdminAlertKeys.id, row.id));
    }
    return pendingPayments(db);
  });
}

/** OceanX Admin phone app, signed in: its one screen (payments waiting, active accounts) and its alert key. */
export async function superAdminPhoneRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const saAudit = (ctx: ReturnType<typeof saCtx>) => ({ actorType: 'super_admin' as const, actorId: ctx.admin.id, actorName: ctx.admin.name });

  app.get('/phone/summary', async () => {
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const [active, received, pending] = await Promise.all([
      db
        .select({ product: businesses.product, n: count() })
        .from(businesses)
        .where(and(eq(businesses.status, 'active'), isNull(businesses.deletedAt)))
        .groupBy(businesses.product),
      db
        .select({ currency: billingPayments.currency, total: sql<string>`sum(${billingPayments.amount})::text`, n: count() })
        .from(billingPayments)
        .where(and(eq(billingPayments.status, 'approved'), gte(billingPayments.reviewedAt, monthStart)))
        .groupBy(billingPayments.currency),
      pendingPayments(db),
    ]);
    return {
      pending: pending.pending,
      receivedThisMonth: received.map((r) => ({ currency: r.currency, total: Number(r.total), count: r.n })),
      activeAccounts: ['pos', 'gravity', 'flow', 'budget'].map((product) => ({ product, active: active.find((a) => a.product === product)?.n ?? 0 })),
    };
  });

  /** Turn on notifications on this phone: a new key, shown once (the phone keeps it). */
  app.post('/alerts/keys', async (req, reply) => {
    const ctx = saCtx(req);
    const { device } = parse(z.object({ device: z.string().trim().max(80).default('') }), req.body ?? {});
    const key = randomToken();
    const [k] = await db.insert(superAdminAlertKeys).values({ superAdminId: ctx.admin.id, tokenHash: hashToken(key), device }).returning({ id: superAdminAlertKeys.id });
    await audit(db, { ...saAudit(ctx), action: 'superadmin.alert_key_created', entityType: 'super_admin_alert_key', entityId: k!.id, metadata: { device }, req });
    reply.status(201);
    return { id: k!.id, key };
  });

  app.get('/alerts/keys', async (req) => {
    const ctx = saCtx(req);
    const rows = await db
      .select({ id: superAdminAlertKeys.id, device: superAdminAlertKeys.device, createdAt: superAdminAlertKeys.createdAt, lastUsedAt: superAdminAlertKeys.lastUsedAt })
      .from(superAdminAlertKeys)
      .where(and(eq(superAdminAlertKeys.superAdminId, ctx.admin.id), isNull(superAdminAlertKeys.revokedAt)))
      .orderBy(desc(superAdminAlertKeys.createdAt));
    return { items: rows };
  });

  /** Turn notifications off for a phone (the key stops working at once). */
  app.delete('/alerts/keys/:id', async (req) => {
    const ctx = saCtx(req);
    const [k] = await db
      .update(superAdminAlertKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(superAdminAlertKeys.id, idParam(req)), eq(superAdminAlertKeys.superAdminId, ctx.admin.id), isNull(superAdminAlertKeys.revokedAt)))
      .returning({ id: superAdminAlertKeys.id });
    if (!k) throw notFound();
    await audit(db, { ...saAudit(ctx), action: 'superadmin.alert_key_removed', entityType: 'super_admin_alert_key', entityId: k.id, req });
    return { ok: true };
  });
}
