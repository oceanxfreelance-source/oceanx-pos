import { notInArray, sql } from 'drizzle-orm';
import { ADDONS, LANGUAGES, PERMISSIONS, PLAN_MODULES, SYSTEM_ROLE_TEMPLATES, type AddonKey } from '@oceanx/shared';
import type { Executor } from './client';
import { addons, permissions, platformLanguages, plans } from './schema';

const ADDON_INFO: Record<AddonKey, { name: string; category: string; description: string }> = {
  credit: { name: 'Credit / Customer Due', category: 'finance', description: 'Credit sales, customer due, credit limits and statements.' },
  multi_outlet: { name: 'Multiple Outlets', category: 'operations', description: 'Run several branches with outlet-level staff, stock and reports.' },
  karaoke: { name: 'Karaoke Rooms', category: 'hospitality', description: 'Room bookings, hourly pricing, packages and deposits.' },
  delivery: { name: 'Delivery', category: 'sales', description: 'Delivery orders, drivers and delivery fees.' },
  reservations: { name: 'Table Reservations', category: 'hospitality', description: 'Table bookings and availability.' },
  qr_menu: { name: 'QR Menu', category: 'sales', description: 'Public digital menu via QR code.' },
  online_ordering: { name: 'Online Ordering', category: 'sales', description: 'Customer self-ordering online.' },
  loyalty: { name: 'Loyalty', category: 'marketing', description: 'Points and rewards for customers.' },
  catering: { name: 'Catering', category: 'sales', description: 'Catering orders and packages.' },
  events: { name: 'Event Management', category: 'hospitality', description: 'Events, packages and bookings.' },
  guesthouse: { name: 'Guesthouse Management', category: 'hospitality', description: 'Rooms, stays and guest billing.' },
  advanced_inventory: { name: 'Advanced Inventory', category: 'operations', description: 'Batches, transfers and stock counts.' },
  recipes: { name: 'Recipe Management', category: 'operations', description: 'Recipes linking menu items to ingredients.' },
  ingredient_costing: { name: 'Ingredient Costing', category: 'operations', description: 'Food cost and margin analysis.' },
  advanced_kitchen: { name: 'Advanced Kitchen', category: 'operations', description: 'Kitchen stations, routing and prep times.' },
  payroll: { name: 'Payroll (Salary Sheet)', category: 'staff', description: 'Staff list and monthly salary sheets with allowances, overtime, deductions and advances.' },
  staff_rota: { name: 'Duty Rota', category: 'staff', description: 'Weekly duty rota: shifts, days off and leave for every staff member.' },
};

const ALL = [...PLAN_MODULES];
const DEFAULT_PLANS = [
  { code: 'trial', name: 'Trial', priceMonthly: '0', trialDays: 14, sortOrder: 0, limits: { max_users: 5, max_outlets: 1, max_products: 200, storage_mb: 200 }, modules: ALL },
  {
    code: 'basic',
    name: 'Basic',
    priceMonthly: '29',
    trialDays: 0,
    sortOrder: 1,
    limits: { max_users: 5, max_outlets: 1, max_products: 300, storage_mb: 500, report_history_days: 90 },
    modules: ['pos', 'sales', 'products', 'customers', 'tables', 'kitchen', 'expenses', 'reports'],
  },
  {
    code: 'pro',
    name: 'Pro',
    priceMonthly: '59',
    trialDays: 0,
    sortOrder: 2,
    limits: { max_users: 15, max_outlets: 2, max_products: 2000, storage_mb: 2000, report_history_days: 365 },
    modules: ALL,
  },
  {
    code: 'business',
    name: 'Business',
    priceMonthly: '119',
    trialDays: 0,
    sortOrder: 3,
    limits: { max_users: 50, max_outlets: 10, max_products: null, storage_mb: 10000, report_history_days: null },
    modules: ALL,
  },
  { code: 'custom', name: 'Custom', priceMonthly: '0', trialDays: 0, sortOrder: 4, limits: {}, modules: ALL, isPublic: false },
];

/**
 * Idempotent reference-data sync, run on every migration:
 *  - permission catalog mirrors @oceanx/shared exactly
 *  - languages and add-on registry entries are inserted if missing
 *  - default plans are inserted only if missing (Super Admin edits are preserved)
 * No tenant/demo data is ever created here.
 */
export async function syncReferenceData(db: Executor): Promise<void> {
  const keys = PERMISSIONS.map((p) => p.key);
  const before = new Set((await db.select({ key: permissions.key }).from(permissions)).map((r) => r.key));
  for (const p of PERMISSIONS) {
    await db
      .insert(permissions)
      .values({ key: p.key, module: p.module, addon: 'addon' in p ? (p.addon ?? null) : null })
      .onConflictDoUpdate({ target: permissions.key, set: { module: p.module, addon: 'addon' in p ? (p.addon ?? null) : null } });
  }
  await db.delete(permissions).where(notInArray(permissions.key, keys));

  for (const [i, l] of LANGUAGES.entries()) {
    await db
      .insert(platformLanguages)
      .values({ code: l.code, name: l.name, nativeName: l.nativeName, direction: l.dir, isEnabled: true, isDefault: l.code === 'en', sortOrder: i })
      .onConflictDoNothing();
  }

  for (const code of ADDONS) {
    const info = ADDON_INFO[code];
    await db
      .insert(addons)
      .values({ code, name: info.name, description: info.description, category: info.category, isActive: !NOT_IMPLEMENTED_ADDONS.has(code) })
      .onConflictDoNothing();
  }

  for (const p of DEFAULT_PLANS) {
    await db
      .insert(plans)
      .values({ ...p, description: '', currency: 'USD', limits: p.limits as Record<string, number | null>, modules: p.modules })
      .onConflictDoNothing();
  }
  // The protected Business Admin role always holds every permission, including ones added in later releases.
  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_key)
    SELECT r.id, p.key FROM roles r CROSS JOIN permissions p WHERE r.system_key = 'business_admin'
    ON CONFLICT DO NOTHING`);
  // Permissions introduced by this release go to existing system roles whose template includes them
  // (e.g. a new Manager feature). Only new keys: later edits a business makes to its roles are kept.
  if (before.size > 0) {
    for (const [roleKey, perms] of Object.entries(SYSTEM_ROLE_TEMPLATES)) {
      const added = perms.filter((k) => !before.has(k));
      if (roleKey === 'business_admin' || added.length === 0) continue;
      await db.execute(sql`
        INSERT INTO role_permissions (role_id, permission_key)
        SELECT r.id, p.key FROM roles r JOIN permissions p ON p.key IN (${sql.join(
          added.map((k) => sql`${k}`),
          sql`, `,
        )})
        WHERE r.system_key = ${roleKey}
        ON CONFLICT DO NOTHING`);
    }
  }
}

/** Add-ons listed in the catalog but without a shipped implementation yet; created inactive (cannot be granted). */
export const NOT_IMPLEMENTED_ADDONS = new Set<AddonKey>(['catering', 'events', 'guesthouse']);
