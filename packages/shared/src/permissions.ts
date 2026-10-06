import type { AddonKey, ModuleKey } from './modules';

/**
 * Granular permission catalog. Authorization is ALWAYS evaluated server-side
 * against these keys; role names are never used for authorization decisions.
 *
 * A permission is only *effective* for a business when its module is enabled
 * by the subscription plan (or is a core module) and, when `addon` is set,
 * the add-on has been granted by Super Admin.
 */
export interface PermissionDef {
  key: string;
  module: ModuleKey;
  addon?: AddonKey;
}

const p = (key: string, module: ModuleKey, addon?: AddonKey): PermissionDef => ({ key, module, addon });

export const PERMISSIONS = [
  p('dashboard.view', 'dashboard'),

  p('pos.access', 'pos'),
  p('pos.discount', 'pos'),
  p('pos.refund', 'pos'),

  p('sales.view', 'sales'),
  p('sales.create', 'sales'),
  p('sales.edit', 'sales'),
  p('sales.void', 'sales'),

  p('products.view', 'products'),
  p('products.create', 'products'),
  p('products.edit', 'products'),
  p('products.delete', 'products'),
  p('categories.view', 'products'),
  p('categories.manage', 'products'),

  p('inventory.view', 'inventory'),
  p('inventory.adjust', 'inventory'),
  p('inventory.manage', 'inventory'),

  p('purchases.view', 'purchases'),
  p('purchases.create', 'purchases'),
  p('purchases.edit', 'purchases'),

  p('suppliers.view', 'suppliers'),
  p('suppliers.manage', 'suppliers'),

  p('customers.view', 'customers'),
  p('customers.create', 'customers'),
  p('customers.edit', 'customers'),
  p('customers.delete', 'customers'),

  p('quotations.view', 'quotations'),
  p('quotations.create', 'quotations'),
  p('quotations.edit', 'quotations'),
  p('quotations.delete', 'quotations'),
  p('quotations.convert_to_invoice', 'quotations'),
  p('quotations.print', 'quotations'),
  p('quotations.send', 'quotations'),
  p('quotation_settings.view', 'quotations'),
  p('quotation_settings.manage', 'quotations'),

  p('invoices.view', 'invoices'),
  p('invoices.create', 'invoices'),
  p('invoices.edit', 'invoices'),
  p('invoices.delete', 'invoices'),
  p('invoices.print', 'invoices'),
  p('invoices.send', 'invoices'),
  p('invoices.void', 'invoices'),
  p('invoices.payment', 'invoices'),
  p('invoice_settings.view', 'invoices'),
  p('invoice_settings.manage', 'invoices'),

  p('expenses.view', 'expenses'),
  p('expenses.create', 'expenses'),
  p('expenses.edit', 'expenses'),
  p('expenses.delete', 'expenses'),

  p('tables.view', 'tables'),
  p('tables.manage', 'tables'),

  p('kitchen.view', 'kitchen'),
  p('kitchen.manage', 'kitchen'),

  p('reports.view', 'reports'),
  p('reports.export', 'reports'),

  p('users.view', 'users'),
  p('users.create', 'users'),
  p('users.edit', 'users'),
  p('users.delete', 'users'),

  p('roles.view', 'roles'),
  p('roles.manage', 'roles'),

  p('settings.view', 'settings'),
  p('settings.manage', 'settings'),

  p('addons.view', 'addons'),
  p('addons.configure', 'addons'),

  p('audit.view', 'audit'),

  p('credit.view', 'customers', 'credit'),
  p('credit.create', 'customers', 'credit'),
  p('credit.payment', 'customers', 'credit'),
  p('credit.manage', 'customers', 'credit'),

  p('outlets.view', 'settings', 'multi_outlet'),
  p('outlets.manage', 'settings', 'multi_outlet'),
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((x) => x.key);

const PERMISSION_MAP = new Map<string, PermissionDef>(PERMISSIONS.map((x) => [x.key, x]));

export function getPermission(key: string): PermissionDef | undefined {
  return PERMISSION_MAP.get(key);
}

export function isPermissionKey(key: string): key is PermissionKey {
  return PERMISSION_MAP.has(key);
}

/** Group permission definitions by module, preserving catalog order. */
export function groupPermissionsByModule(defs: readonly PermissionDef[] = PERMISSIONS): Record<string, PermissionDef[]> {
  const out: Record<string, PermissionDef[]> = {};
  for (const d of defs) (out[d.module] ??= []).push(d);
  return out;
}

/**
 * System role templates created for every new business. They are ordinary
 * rows in the `roles` table afterwards (Business Admin may edit all except
 * `business_admin`, which always holds every permission).
 */
export const SYSTEM_ROLE_KEYS = ['business_admin', 'manager', 'salesperson', 'cashier', 'kitchen_staff', 'waiter'] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

const MANAGER_EXCLUDED = new Set<string>(['users.delete', 'roles.manage', 'settings.manage', 'addons.configure', 'outlets.manage']);

export const SYSTEM_ROLE_TEMPLATES: Record<SystemRoleKey, readonly PermissionKey[]> = {
  business_admin: PERMISSION_KEYS,
  manager: PERMISSION_KEYS.filter((k) => !MANAGER_EXCLUDED.has(k)),
  salesperson: [
    'dashboard.view',
    'customers.view',
    'customers.create',
    'quotations.view',
    'quotations.create',
    'quotations.edit',
    'quotations.convert_to_invoice',
    'quotations.print',
    'quotations.send',
    'invoices.view',
    'invoices.create',
    'invoices.print',
  ],
  cashier: ['dashboard.view', 'pos.access', 'sales.view', 'sales.create', 'customers.view', 'customers.create', 'invoices.payment'],
  kitchen_staff: ['dashboard.view', 'kitchen.view', 'kitchen.manage'],
  waiter: ['dashboard.view', 'pos.access', 'sales.view', 'sales.create', 'tables.view', 'kitchen.view', 'customers.view'],
};
