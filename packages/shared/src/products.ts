/**
 * OceanX products sold on the same platform. Every business account belongs to one product and
 * every plan is for one product. Super Admin manages them all.
 *  - pos:     OceanX POS (restaurants, cafés, shops, supermarkets)
 *  - gravity: Gravity, the quotation & invoice generator (English and Dhivehi documents)
 *  - flow:    Gravity Flow, income, expenses and profit (daily and monthly) for small businesses
 *  - budget:  Gravity Budget, a personal money manager: where the money goes, monthly budgets, bills and savings goals
 *  - fuel:    Theyo Fihaara (ތެޔޮ ފިހާރަ), the fuel shed system: pumps, tanks, shifts, credit customers, quotations and invoices
 */
export const PRODUCTS = ['pos', 'gravity', 'flow', 'budget', 'fuel'] as const;
export type Product = (typeof PRODUCTS)[number];

/** What a Gravity account can use (on top of the core: dashboard, users, roles, settings, audit). Lines are typed on each document: no product catalogue, no POS. */
export const GRAVITY_MODULES = ['customers', 'quotations', 'invoices'] as const;
/** Core modules a Gravity account does not get: it is a one-person tool (no team, roles or activity log) and add-ons are POS extras. */
export const GRAVITY_EXCLUDED_CORE = ['addons', 'users', 'roles', 'audit'] as const;
/** Gravity documents are made in English or Dhivehi. */
export const GRAVITY_DOCUMENT_LANGUAGES = ['en', 'dv'] as const;

/** What a Gravity Flow account can use (on top of the core): income, expenses and profit. */
export const FLOW_MODULES = ['finance'] as const;

/** What a Gravity Budget account can use (on top of the core): spending, budgets, bills and goals. */
export const BUDGET_MODULES = ['budget'] as const;

/** What a Theyo Fihaara (fuel shed) account can use (on top of the core, team included). */
export const FUEL_MODULES = ['fuel'] as const;

/** Modules only their own product may use (never in a POS plan). */
export const PRODUCT_ONLY_MODULES = [...FLOW_MODULES, ...BUDGET_MODULES, ...FUEL_MODULES] as const;

/** Team products other than POS (Theyo Fihaara): their own modules plus the core (team, roles, activity log), never POS features or add-ons. */
export const TEAM_PRODUCT_MODULES: Record<string, readonly string[]> = { fuel: FUEL_MODULES };

/** One-person products (Gravity, Gravity Flow, Gravity Budget): no team, roles, activity log or add-ons; documents and money only. */
export const SOLO_PRODUCTS = ['gravity', 'flow', 'budget'] as const;
export const isSoloProduct = (p: string | null | undefined) => (SOLO_PRODUCTS as readonly string[]).includes(p ?? '');
/** The modules each one-person product may use, besides the core. */
export const SOLO_PRODUCT_MODULES: Record<string, readonly string[]> = { gravity: GRAVITY_MODULES, flow: FLOW_MODULES, budget: BUDGET_MODULES };
