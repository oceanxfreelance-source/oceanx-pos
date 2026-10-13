import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { PRODUCTS } from "@oceanx/shared";
import { businesses, signups, subscriptions } from "../../db/schema";
import { parse } from "../../lib/validation";
import { getPlatformSettings } from "../../services/platformSettings";
import {
  AUTO_DELETE_PRODUCT,
  trialDeletionAt,
} from "../../services/trialCleanup";

const querySchema = z.object({
  product: z.enum(PRODUCTS).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Every self sign-up (newest first), also accounts that were deleted after an unpaid trial: who registered,
 * how to reach them, and where the account stands now (on trial, trial ended and when it will be deleted, paid, deleted).
 */
export async function signupRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  app.get("/signups", async (req) => {
    const q = parse(querySchema, req.query);
    const conds: SQL[] = [];
    if (q.product) conds.push(eq(signups.product, q.product));
    if (q.q)
      conds.push(
        or(
          ilike(signups.businessName, `%${q.q}%`),
          ilike(signups.ownerName, `%${q.q}%`),
          ilike(signups.email, `%${q.q}%`),
          ilike(signups.phone, `%${q.q}%`),
        )!,
      );
    const where = conds.length ? and(...conds) : undefined;
    const paid = sql<number>`(SELECT count(*)::int FROM billing_payments p WHERE p.business_id = ${signups.businessId} AND p.status = 'approved')`;
    const reviewing = sql<number>`(SELECT count(*)::int FROM billing_payments p WHERE p.business_id = ${signups.businessId} AND p.status = 'pending')`;
    const [rows, [total], settings] = await Promise.all([
      db
        .select({
          s: signups,
          live: businesses.id,
          subStatus: subscriptions.status,
          periodEnd: subscriptions.currentPeriodEnd,
          paid,
          reviewing,
        })
        .from(signups)
        .leftJoin(businesses, eq(businesses.id, signups.businessId))
        .leftJoin(
          subscriptions,
          eq(subscriptions.businessId, signups.businessId),
        )
        .where(where)
        .orderBy(desc(signups.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(signups).where(where),
      getPlatformSettings(db),
    ]);
    const now = new Date();
    const items = rows.map((r) => {
      let state:
        | "deleted"
        | "trial"
        | "trial_ended"
        | "paid"
        | "payment_review"
        | "active";
      let deleteAt: Date | null = null;
      if (r.s.deletedAt || !r.live) state = "deleted";
      else if (r.paid > 0) state = "paid";
      else if (r.subStatus !== "trialing") state = "active";
      else if (r.periodEnd && r.periodEnd > now) state = "trial";
      else if (r.reviewing > 0) state = "payment_review";
      else {
        state = "trial_ended";
        deleteAt =
          r.periodEnd && r.s.product === AUTO_DELETE_PRODUCT
            ? trialDeletionAt(
                r.periodEnd,
                r.s.trialEndedNoticeAt,
                settings.trialDeleteHours,
                now,
              )
            : null;
      }
      return {
        id: r.s.id,
        businessId: r.live ? r.s.businessId : null,
        product: r.s.product,
        businessName: r.s.businessName,
        ownerName: r.s.ownerName,
        email: r.s.email,
        phone: r.s.phone,
        language: r.s.language,
        createdAt: r.s.createdAt,
        trialEnd: r.subStatus === "trialing" ? r.periodEnd : null,
        state,
        deleteAt,
        deletedAt: r.s.deletedAt,
      };
    });
    return {
      items,
      total: Number(total?.n ?? 0),
      page: q.page,
      pageSize: q.pageSize,
      trialDeleteHours: settings.trialDeleteHours,
    };
  });
}
