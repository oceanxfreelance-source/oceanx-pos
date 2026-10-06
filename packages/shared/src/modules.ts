/**
 * Module & add-on registry.
 *
 * A *module* is a core capability that a subscription plan can include
 * (plans store a list of module keys — limits are never hard-coded here).
 * An *add-on* is an optional capability that Super Admin grants per business.
 *
 * Core modules are always available to every business regardless of plan.
 */

export const CORE_MODULES = ['dashboard', 'users', 'roles', 'settings', 'addons', 'audit'] as const;

export const PLAN_MODULES = [
  'pos',
  'sales',
  'products',
  'inventory',
  'purchases',
  'suppliers',
  'customers',
  'quotations',
  'invoices',
  'expenses',
  'tables',
  'kitchen',
  'reports',
] as const;

export const MODULES = [...CORE_MODULES, ...PLAN_MODULES] as const;

export type CoreModuleKey = (typeof CORE_MODULES)[number];
export type PlanModuleKey = (typeof PLAN_MODULES)[number];
export type ModuleKey = (typeof MODULES)[number];

export const ADDONS = [
  'credit',
  'multi_outlet',
  'karaoke',
  'delivery',
  'reservations',
  'qr_menu',
  'online_ordering',
  'loyalty',
  'catering',
  'events',
  'guesthouse',
  'advanced_inventory',
  'recipes',
  'ingredient_costing',
  'advanced_kitchen',
] as const;

export type AddonKey = (typeof ADDONS)[number];

export function isCoreModule(key: string): key is CoreModuleKey {
  return (CORE_MODULES as readonly string[]).includes(key);
}

export function isPlanModule(key: string): key is PlanModuleKey {
  return (PLAN_MODULES as readonly string[]).includes(key);
}

export function isAddonKey(key: string): key is AddonKey {
  return (ADDONS as readonly string[]).includes(key);
}

/** Plan limit keys. Values live in the database (plans.limits), never in code. */
export const PLAN_LIMIT_KEYS = ['max_users', 'max_outlets', 'max_products', 'storage_mb', 'report_history_days'] as const;
export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number];
/** `null` means unlimited. */
export type PlanLimits = Partial<Record<PlanLimitKey, number | null>>;
