import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, count, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { PRODUCTS, reviewRequestSchema } from '@oceanx/shared';
import { reviewPromptStates, reviewRequests, reviews } from '../../db/schema';
import { saCtx } from '../../guards/superadmin';
import { audit } from '../../lib/audit';
import { notFound } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { parse } from '../../lib/validation';

const listQuery = z.object({
  product: z.enum(PRODUCTS).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

/** Super Admin: ask an app's users for a review (a popup in the app), stop asking, and read the reviews. */
export async function reviewAdminRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const saAudit = (ctx: ReturnType<typeof saCtx>) => ({ actorType: 'super_admin' as const, actorId: ctx.admin.id, actorName: ctx.admin.name });

  /** Requests, newest first, with how many answered and how many said "later". */
  app.get('/review-requests', async () => {
    const answered = sql<number>`(SELECT count(*)::int FROM ${reviewPromptStates} s WHERE s.request_id = ${reviewRequests.id} AND s.status = 'done')`;
    const later = sql<number>`(SELECT count(*)::int FROM ${reviewPromptStates} s WHERE s.request_id = ${reviewRequests.id} AND s.status = 'later')`;
    const items = await db
      .select({ id: reviewRequests.id, product: reviewRequests.product, message: reviewRequests.message, createdAt: reviewRequests.createdAt, closedAt: reviewRequests.closedAt, answered, later })
      .from(reviewRequests)
      .orderBy(desc(reviewRequests.createdAt))
      .limit(50);
    return { items };
  });

  app.post('/review-requests', async (req, reply) => {
    const ctx = saCtx(req);
    const body = parse(reviewRequestSchema, req.body);
    const [row] = await db
      .insert(reviewRequests)
      .values({ product: body.product, message: body.message || null, createdBy: ctx.admin.id })
      .returning();
    await audit(db, { ...saAudit(ctx), action: 'superadmin.review_request_sent', entityType: 'review_request', entityId: row!.id, metadata: { product: body.product ?? 'all' }, req });
    reply.status(201);
    return row;
  });

  /** Stop asking: the popup no longer shows; reviews already written stay. */
  app.post('/review-requests/:id/stop', async (req) => {
    const ctx = saCtx(req);
    const id = idParam(req);
    const [row] = await db
      .update(reviewRequests)
      .set({ closedAt: new Date() })
      .where(and(eq(reviewRequests.id, id), isNull(reviewRequests.closedAt)))
      .returning({ id: reviewRequests.id });
    if (!row) throw notFound();
    await audit(db, { ...saAudit(ctx), action: 'superadmin.review_request_stopped', entityType: 'review_request', entityId: id, req });
    return { ok: true };
  });

  /** Reviews, newest first, with the average and the count per star for the same filter. */
  app.get('/reviews', async (req) => {
    const q = parse(listQuery, req.query);
    const conds: SQL[] = [];
    if (q.product) conds.push(eq(reviews.product, q.product));
    const base = conds.length ? and(...conds) : undefined;
    const where = q.rating ? and(...conds, eq(reviews.rating, q.rating)) : base;
    const [items, [total], stars] = await Promise.all([
      db
        .select({
          id: reviews.id,
          product: reviews.product,
          businessId: reviews.businessId,
          businessName: reviews.businessName,
          userName: reviews.userName,
          rating: reviews.rating,
          comment: reviews.comment,
          asked: sql<boolean>`${reviews.requestId} IS NOT NULL`,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .where(where)
        .orderBy(desc(reviews.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(reviews).where(where),
      db.select({ rating: reviews.rating, n: count() }).from(reviews).where(base).groupBy(reviews.rating),
    ]);
    const all = stars.reduce((a, s) => a + s.n, 0);
    const sum = stars.reduce((a, s) => a + s.rating * s.n, 0);
    return {
      items,
      total: total?.n ?? 0,
      page: q.page,
      pageSize: q.pageSize,
      summary: { count: all, average: all ? Math.round((sum / all) * 10) / 10 : null, byRating: Object.fromEntries([1, 2, 3, 4, 5].map((r) => [r, stars.find((s) => s.rating === r)?.n ?? 0])) },
    };
  });
}
