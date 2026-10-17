import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { DB, Executor } from "../db/client";
import {
  billingPayments,
  businesses,
  signups,
  storedFiles,
  subscriptions,
  users,
} from "../db/schema";
import { audit } from "../lib/audit";
import type { Mailer } from "../lib/mailer";
import { appUrlFor, type AppConfig } from "../config";
import { getPlatformSettings } from "./platformSettings";

const HOUR = 3_600_000;
/**
 * Gravity and Gravity Flow accounts are deleted when their free trial ends unpaid (POS and Gravity Budget never are),
 * each after its own number of hours (Super Admin settings: Gravity 48, Flow 24 by default).
 */
export const AUTO_DELETE_PRODUCTS = ["gravity", "flow"] as const;

/** Hours after an unpaid trial ends before the account is deleted (0 = never, also for products not deleted). */
export function trialDeleteHoursFor(
  product: string,
  settings: { trialDeleteHours: number; flowTrialDeleteHours: number },
) {
  if (product === "gravity") return settings.trialDeleteHours;
  if (product === "flow") return settings.flowTrialDeleteHours;
  return 0;
}

/** Never emptied when an account is deleted: the account row itself (last), the sign-up record and Super Admin's Hub. */
const KEEP_TABLES = new Set([
  "businesses",
  "signups",
  "hub_clients",
  "hub_tickets",
]);

/**
 * When an unpaid trial will be deleted: `hours` after the trial ended, counted from when the owner was told
 * (so accounts whose trial ended before this rule existed still get the full time). null = never.
 */
export function trialDeletionAt(
  trialEnd: Date,
  noticeAt: Date | null,
  hours: number,
  now = new Date(),
): Date | null {
  if (hours <= 0) return null;
  const start = Math.max(trialEnd.getTime(), (noticeAt ?? now).getTime());
  return new Date(start + hours * HOUR);
}

/** Has this account ever paid, or sent a payment that is waiting for review? Then it is never auto-deleted. */
async function hasPayment(db: Executor, businessId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(billingPayments)
    .where(
      and(
        eq(billingPayments.businessId, businessId),
        inArray(billingPayments.status, ["approved", "pending"]),
      ),
    );
  return (row?.n ?? 0) > 0;
}

/** The deletion time shown to the owner on the "trial ended" screen (null when it will not be deleted). */
export async function deletionForBusiness(
  db: Executor,
  business: { id: string; product: string },
  sub: { status: string; currentPeriodEnd: Date } | null,
  now = new Date(),
) {
  const businessId = business.id;
  if (
    !sub ||
    sub.status !== "trialing" ||
    sub.currentPeriodEnd > now
  )
    return null;
  const settings = await getPlatformSettings(db);
  const hours = trialDeleteHoursFor(business.product, settings);
  if (hours <= 0 || (await hasPayment(db, businessId))) return null;
  const [s] = await db
    .select({ noticeAt: signups.trialEndedNoticeAt })
    .from(signups)
    .where(eq(signups.businessId, businessId));
  return trialDeletionAt(sub.currentPeriodEnd, s?.noticeAt ?? null, hours, now);
}

/**
 * Tables holding an account's data, children before parents, so deleting in this order never trips a foreign key.
 * Read from the database itself, so new tables are included automatically.
 */
async function tenantTablesInDeleteOrder(db: Executor): Promise<string[]> {
  const cols = await db.execute<{ t: string }>(
    sql`SELECT table_name AS t FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'business_id'`,
  );
  const tables = new Set(
    cols.rows.map((r) => r.t).filter((t) => !KEEP_TABLES.has(t)),
  );
  const fks = await db.execute<{ child: string; parent: string }>(sql`
    SELECT c.relname AS child, p.relname AS parent FROM pg_constraint k
    JOIN pg_class c ON c.oid = k.conrelid JOIN pg_class p ON p.oid = k.confrelid
    WHERE k.contype = 'f' AND c.relnamespace = 'public'::regnamespace`);
  // parent -> children still to delete first
  const children = new Map<string, Set<string>>(
    [...tables].map((t) => [t, new Set<string>()]),
  );
  for (const { child, parent } of fks.rows)
    if (child !== parent && tables.has(child) && tables.has(parent))
      children.get(parent)!.add(child);
  const order: string[] = [];
  const done = new Set<string>();
  while (done.size < tables.size) {
    const ready = [...tables].filter(
      (t) => !done.has(t) && [...children.get(t)!].every((c) => done.has(c)),
    );
    if (!ready.length)
      throw new Error(
        "Cannot order account tables for deletion (circular references)",
      );
    for (const t of ready.sort()) {
      order.push(t);
      done.add(t);
    }
  }
  return order;
}

/** Deletes an account and everything in it (records, users, files). Its sign-up record stays, marked deleted. */
export async function deleteBusinessCompletely(
  db: DB,
  businessId: string,
  reason: string,
) {
  const tables = await tenantTablesInDeleteOrder(db);
  await db.transaction(async (tx) => {
    for (const t of tables)
      await tx.execute(
        sql`DELETE FROM ${sql.identifier(t)} WHERE business_id = ${businessId}`,
      );
    await tx
      .delete(storedFiles)
      .where(sql`${storedFiles.path} LIKE ${`businesses/${businessId}/%`}`);
    await tx.delete(businesses).where(eq(businesses.id, businessId));
    await tx
      .update(signups)
      .set({ deletedAt: new Date(), deleteReason: reason })
      .where(eq(signups.businessId, businessId));
  });
}

export interface SweepDeps {
  db: DB;
  mailer: Mailer;
  config: AppConfig;
  /** Removes files kept on disk (the database copy is removed with the account). */
  removeFiles?: (businessId: string) => Promise<void>;
}

/**
 * Unpaid Gravity and Gravity Flow free trials: when one ends, the owner is emailed that the account will be deleted
 * unless they pay within the set hours (Gravity 48, Flow 24 by default); after that the account and all its data are deleted. Accounts that
 * paid, sent a payment for review, or were activated by Super Admin are never touched. Safe to run often.
 */
export async function sweepEndedTrials(deps: SweepDeps, now = new Date()) {
  const { db, mailer, config } = deps;
  const settings = await getPlatformSettings(db);
  const result = { noticed: 0, deleted: 0 };
  const products = AUTO_DELETE_PRODUCTS.filter((p) => trialDeleteHoursFor(p, settings) > 0);
  if (!products.length) return result;
  const ended = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      product: businesses.product,
      trialEnd: subscriptions.currentPeriodEnd,
      noticeAt: signups.trialEndedNoticeAt,
      hasSignup: signups.id,
    })
    .from(businesses)
    .innerJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .leftJoin(signups, eq(signups.businessId, businesses.id))
    .where(
      and(
        isNull(businesses.deletedAt),
        inArray(businesses.product, [...products]),
        eq(subscriptions.status, "trialing"),
        lt(subscriptions.currentPeriodEnd, now),
      ),
    );

  for (const b of ended) {
    if (await hasPayment(db, b.id)) continue;
    const hours = trialDeleteHoursFor(b.product, settings);
    let noticeAt = b.noticeAt;
    if (!noticeAt) {
      const [owner] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(and(eq(users.businessId, b.id), eq(users.isOwner, true)))
        .limit(1);
      // Claim the notice first, so two runs at the same moment never email twice.
      const claimed = b.hasSignup
        ? await db
            .update(signups)
            .set({ trialEndedNoticeAt: now })
            .where(
              and(
                eq(signups.businessId, b.id),
                isNull(signups.trialEndedNoticeAt),
              ),
            )
            .returning({ id: signups.id })
        : await db
            .insert(signups)
            .values({
              businessId: b.id,
              product: b.product,
              businessName: b.name,
              ownerName: owner?.name ?? "",
              email: owner?.email ?? "",
              trialEndedNoticeAt: now,
            })
            .onConflictDoNothing()
            .returning({ id: signups.id });
      noticeAt = now;
      if (!claimed.length) continue;
      const deleteAt = trialDeletionAt(
        b.trialEnd,
        noticeAt,
        hours,
        now,
      )!;
      if (owner) {
        await mailer
          .send({
            to: owner.email,
            subject: `Your free trial has ended: ${b.name}`,
            text: [
              `Hello ${owner.name},`,
              "",
              `The free trial for ${b.name} has ended.`,
              `To keep your account and everything in it, choose a plan and pay before ${deleteAt.toUTCString()}.`,
              "If it is not paid by then, the account and all its data will be deleted permanently.",
              "",
              `Sign in to pay: ${appUrlFor(config, b.product)}`,
              "",
              settings.platformName,
            ].join("\n"),
          })
          .catch(() => undefined);
      }
      result.noticed++;
    }
    const deleteAt = trialDeletionAt(
      b.trialEnd,
      noticeAt,
      hours,
      now,
    )!;
    if (now < deleteAt) continue;
    await deleteBusinessCompletely(db, b.id, "trial_not_renewed");
    await deps.removeFiles?.(b.id).catch(() => undefined);
    await audit(db, {
      actorType: "system",
      action: "business.deleted_unpaid_trial",
      entityType: "business",
      entityId: b.id,
      metadata: {
        name: b.name,
        product: b.product,
        trialEnd: b.trialEnd.toISOString(),
      },
    });
    result.deleted++;
  }
  return result;
}
