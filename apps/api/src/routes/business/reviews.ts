import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { reviewSchema } from '@oceanx/shared';
import { reviewPromptStates, reviewRequests, reviews } from '../../db/schema';
import { bizCtx } from '../../guards/business';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { idParam } from '../../lib/params';
import { actor } from '../../lib/tenant';
import { parse } from '../../lib/validation';

/** "Later" asks again after this long. */
export const REVIEW_LATER_DAYS = 3;

/**
 * Reviews of the app. Super Admin's request pops up for the account owner (with "Later"); anyone signed in
 * can also write a review on their own from the user menu.
 */
export async function reviewRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  /**
   * The review request to show now, if any: the newest open one for this app that the owner has not
   * answered and has not put off. Accounts that started after the request was sent are not asked.
   */
  app.get('/reviews/prompt', async (req) => {
    const ctx = bizCtx(req);
    if (!ctx.user.isOwner) return { request: null };
    const business = ctx.access.business;
    const now = new Date();
    const [row] = await db
      .select({ id: reviewRequests.id, message: reviewRequests.message })
      .from(reviewRequests)
      .leftJoin(reviewPromptStates, and(eq(reviewPromptStates.requestId, reviewRequests.id), eq(reviewPromptStates.userId, ctx.user.id)))
      .where(
        and(
          isNull(reviewRequests.closedAt),
          or(isNull(reviewRequests.product), eq(reviewRequests.product, business.product)),
          lte(sql`${business.createdAt}::timestamptz`, reviewRequests.createdAt),
          or(isNull(reviewPromptStates.status), and(eq(reviewPromptStates.status, 'later'), lte(reviewPromptStates.remindAt, now))),
        ),
      )
      .orderBy(desc(reviewRequests.createdAt))
      .limit(1);
    return { request: row ?? null };
  });

  /** "Later": the same request pops up again in a few days. */
  app.post('/reviews/prompt/:id/later', async (req) => {
    const ctx = bizCtx(req);
    const id = idParam(req);
    const remindAt = new Date(Date.now() + REVIEW_LATER_DAYS * 86_400_000);
    await db
      .insert(reviewPromptStates)
      .values({ requestId: id, userId: ctx.user.id, status: 'later', remindAt })
      .onConflictDoUpdate({
        target: [reviewPromptStates.requestId, reviewPromptStates.userId],
        set: { status: 'later', remindAt, updatedAt: new Date() },
        // An answered request stays answered.
        where: eq(reviewPromptStates.status, 'later'),
      })
      .catch((e: { code?: string }) => {
        if (e.code === '23503') throw new AppError('not_found', 'Review request not found');
        throw e;
      });
    return { ok: true };
  });

  /** Send a review: from the popup (requestId) or written on their own. */
  app.post('/reviews', async (req, reply) => {
    const ctx = bizCtx(req);
    const body = parse(reviewSchema, req.body);
    const business = ctx.access.business;
    const created = await db.transaction(async (tx) => {
      if (body.requestId) {
        const [r] = await tx
          .select({ id: reviewRequests.id })
          .from(reviewRequests)
          .where(and(eq(reviewRequests.id, body.requestId), or(isNull(reviewRequests.product), eq(reviewRequests.product, business.product))));
        if (!r) throw new AppError('not_found', 'Review request not found');
        const [done] = await tx
          .select({ status: reviewPromptStates.status })
          .from(reviewPromptStates)
          .where(and(eq(reviewPromptStates.requestId, r.id), eq(reviewPromptStates.userId, ctx.user.id), eq(reviewPromptStates.status, 'done')));
        if (done) throw new AppError('conflict', 'Already reviewed');
        await tx
          .insert(reviewPromptStates)
          .values({ requestId: r.id, userId: ctx.user.id, status: 'done' })
          .onConflictDoUpdate({ target: [reviewPromptStates.requestId, reviewPromptStates.userId], set: { status: 'done', remindAt: null, updatedAt: new Date() } });
      }
      const [row] = await tx
        .insert(reviews)
        .values({
          businessId: ctx.businessId,
          userId: ctx.user.id,
          product: business.product,
          businessName: business.name,
          userName: ctx.user.name,
          rating: body.rating,
          comment: body.comment || null,
          requestId: body.requestId ?? null,
        })
        .returning({ id: reviews.id, createdAt: reviews.createdAt });
      await audit(tx, { ...actor(ctx), action: 'review.created', entityType: 'review', entityId: row!.id, metadata: { rating: body.rating }, req });
      return row!;
    });
    reply.status(201);
    return created;
  });

  /** The user's own reviews of this app, newest first. */
  app.get('/reviews/mine', async (req) => {
    const ctx = bizCtx(req);
    const rows = await db
      .select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt })
      .from(reviews)
      .where(and(eq(reviews.userId, ctx.user.id), eq(reviews.businessId, ctx.businessId)))
      .orderBy(desc(reviews.createdAt))
      .limit(20);
    return { items: rows };
  });
}
