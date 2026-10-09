import { and, eq, inArray } from 'drizzle-orm';
import { CORE_MODULES, FOOD_ONLY_ADDONS, FOOD_ONLY_MODULES, getPermission, isRetailType, type PlanLimits } from '@oceanx/shared';
import type { Executor } from '../db/client';
import { addons, businessAddons, businesses, plans, subscriptions } from '../db/schema';

export type AccessState =
  | 'ok'
  | 'business_pending'
  | 'business_suspended'
  | 'business_deactivated'
  | 'subscription_expired'
  | 'subscription_cancelled';

export interface BusinessAccess {
  business: typeof businesses.$inferSelect;
  subscription: {
    id: string;
    status: string;
    effectiveStatus: string;
    currentPeriodEnd: Date;
    planId: string;
    planCode: string;
    planName: string;
  } | null;
  limits: PlanLimits;
  modules: Set<string>;
  addons: Set<string>;
  state: AccessState;
}

export function effectiveSubscriptionStatus(status: string, currentPeriodEnd: Date, now = new Date()): string {
  if (status === 'cancelled' || status === 'expired') return status;
  return currentPeriodEnd.getTime() < now.getTime() ? 'expired' : status;
}

/**
 * Business access = business status + subscription + plan modules/limits + granted add-ons.
 * Evaluated on every authenticated business request (server-side, never trusted from client).
 */
export async function loadBusinessAccess(db: Executor, businessId: string): Promise<BusinessAccess | null> {
  const [row] = await db
    .select({ business: businesses, sub: subscriptions, plan: plans })
    .from(businesses)
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!row || row.business.deletedAt) return null;

  const now = new Date();
  const addonRows = await db
    .select({ code: addons.code, expiresAt: businessAddons.expiresAt })
    .from(businessAddons)
    .innerJoin(addons, eq(addons.id, businessAddons.addonId))
    .where(and(eq(businessAddons.businessId, businessId), eq(businessAddons.status, 'active'), eq(addons.isActive, true)));
  const addonSet = new Set(addonRows.filter((a) => !a.expiresAt || a.expiresAt > now).map((a) => a.code));

  const modules = new Set<string>(CORE_MODULES);
  for (const m of row.plan?.modules ?? []) modules.add(m);

  // Shops never get food-service features (kitchen, tables, QR menu, reservations…), whatever the plan or grants say.
  if (isRetailType(row.business.businessType)) {
    for (const m of FOOD_ONLY_MODULES) modules.delete(m);
    for (const a of FOOD_ONLY_ADDONS) addonSet.delete(a);
  }

  const limits: PlanLimits = { ...(row.plan?.limits ?? {}), ...(row.sub?.customLimits ?? {}) };

  let subscription: BusinessAccess['subscription'] = null;
  if (row.sub && row.plan) {
    subscription = {
      id: row.sub.id,
      status: row.sub.status,
      effectiveStatus: effectiveSubscriptionStatus(row.sub.status, row.sub.currentPeriodEnd, now),
      currentPeriodEnd: row.sub.currentPeriodEnd,
      planId: row.plan.id,
      planCode: row.plan.code,
      planName: row.plan.name,
    };
  }

  let state: AccessState = 'ok';
  const b = row.business;
  if (b.status === 'pending') state = 'business_pending';
  else if (b.status === 'suspended') state = 'business_suspended';
  else if (b.status === 'deactivated') state = 'business_deactivated';
  else if (!subscription || subscription.effectiveStatus === 'expired') state = 'subscription_expired';
  else if (subscription.effectiveStatus === 'cancelled') state = 'subscription_cancelled';

  return { business: b, subscription, limits, modules, addons: addonSet, state };
}

/** A permission is effective only if its module is enabled and its add-on (if any) is granted. */
export function isPermissionAvailable(key: string, access: Pick<BusinessAccess, 'modules' | 'addons'>): boolean {
  const def = getPermission(key);
  if (!def) return false;
  if (!access.modules.has(def.module)) return false;
  if (def.addon && !access.addons.has(def.addon)) return false;
  return true;
}

export function effectivePermissions(granted: Iterable<string>, access: Pick<BusinessAccess, 'modules' | 'addons'>): Set<string> {
  const out = new Set<string>();
  for (const k of granted) if (isPermissionAvailable(k, access)) out.add(k);
  return out;
}

export async function businessIdsWithAddon(db: Executor, code: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await db
    .select({ id: businessAddons.businessId })
    .from(businessAddons)
    .innerJoin(addons, eq(addons.id, businessAddons.addonId))
    .where(and(eq(addons.code, code), eq(businessAddons.status, 'active'), inArray(businessAddons.businessId, ids)));
  return new Set(rows.map((r) => r.id));
}

/** Throws-free limit check helper: returns true when `current + adding` stays within the limit. */
export function withinLimit(limits: PlanLimits, key: keyof PlanLimits, current: number, adding = 1): boolean {
  const limit = limits[key];
  if (limit === null || limit === undefined) return true;
  return current + adding <= limit;
}
