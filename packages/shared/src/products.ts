/**
 * OceanX products sold on the same platform. Every business account belongs to one product and
 * every plan is for one product. Super Admin manages them all.
 *  - pos:     OceanX POS (restaurants, cafés, shops, supermarkets)
 *  - gravity: Gravity, the quotation & invoice generator (English and Dhivehi documents)
 */
export const PRODUCTS = ['pos', 'gravity'] as const;
export type Product = (typeof PRODUCTS)[number];

/** What a Gravity account can use (on top of the core: dashboard, users, roles, settings, audit). Lines are typed on each document: no product catalogue, no POS. */
export const GRAVITY_MODULES = ['customers', 'quotations', 'invoices'] as const;
/** Core modules a Gravity account does not get: it is a one-person tool (no team, roles or activity log) and add-ons are POS extras. */
export const GRAVITY_EXCLUDED_CORE = ['addons', 'users', 'roles', 'audit'] as const;
/** Gravity documents are made in English or Dhivehi. */
export const GRAVITY_DOCUMENT_LANGUAGES = ['en', 'dv'] as const;
