import { useEffect } from 'react';
import { forceDark } from './theme';

export type Product = 'pos' | 'gravity' | 'flow' | 'budget' | 'fuel';

const hostList = (v: unknown) =>
  String(v ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

/**
 * Gravity Flow's own address (any host with "flow" in it, e.g. flow.oceanx.app or oceanx-flow.vercel.app,
 * or one listed in VITE_FLOW_HOSTS). Checked before Gravity's, so "gravity-flow" is Flow.
 */
export function isFlowHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.includes('flow') || hostList(import.meta.env.VITE_FLOW_HOSTS).includes(host);
}

/** Gravity Budget's own address (any host with "budget" in it, e.g. budget.oceanx.app, or one listed in VITE_BUDGET_HOSTS). */
export function isBudgetHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.includes('budget') || hostList(import.meta.env.VITE_BUDGET_HOSTS).includes(host);
}

/** Theyo Fihaara's own address (any host with "theyo" in it, e.g. theyo.oceanx.app, or one listed in VITE_FUEL_HOSTS). */
export function isFuelHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.includes('theyo') || hostList(import.meta.env.VITE_FUEL_HOSTS).includes(host);
}

/**
 * Which product this web address serves. Gravity can have its own address (any host with "gravity" in it,
 * e.g. gravity.example.com or oceanx-gravity.vercel.app, or one listed in VITE_GRAVITY_HOSTS). There the app is
 * Gravity only: its own sign-in, sign-up, name, icon and install. The same accounts system serves all products.
 */
export function isGravityHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (isFlowHost(host) || isBudgetHost(host) || isFuelHost(host)) return false;
  return host.includes('gravity') || hostList(import.meta.env.VITE_GRAVITY_HOSTS).includes(host);
}

/** Super Admin's own address (any host with "admin" in it, e.g. admin.oceanx.app or oceanx-admin.vercel.app). */
export function isAdminHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.includes('admin') && !host.includes('gravity') && !host.includes('flow') && !host.includes('budget');
}

export const ADMIN_HOST = typeof window !== 'undefined' && isAdminHost(window.location.hostname);
export const FLOW_HOST = typeof window !== 'undefined' && isFlowHost(window.location.hostname);
export const BUDGET_HOST = typeof window !== 'undefined' && !FLOW_HOST && isBudgetHost(window.location.hostname);
export const FUEL_HOST = typeof window !== 'undefined' && !FLOW_HOST && !BUDGET_HOST && isFuelHost(window.location.hostname);
export const GRAVITY_HOST = typeof window !== 'undefined' && isGravityHost(window.location.hostname);
/** The product this address belongs to ('pos' on the main address). */
export const HOST_PRODUCT: Product = FLOW_HOST ? 'flow' : BUDGET_HOST ? 'budget' : FUEL_HOST ? 'fuel' : GRAVITY_HOST ? 'gravity' : 'pos';

/** Where a product's sign-in and sign-up are: on its own address /login and /register, elsewhere /gravity/login, /flow/login. */
export const productPath = (product: Product, page: 'login' | 'register') => (product === 'pos' || product === HOST_PRODUCT ? `/${page}` : `/${product}/${page}`);

const BRANDING: Record<Exclude<Product, 'pos'>, { title: string; dir: string }> = {
  gravity: { title: 'Gravity: quotations & invoices', dir: 'gravity' },
  flow: { title: 'Gravity Flow: income, expenses & profit', dir: 'flow' },
  budget: { title: 'Gravity Budget: know where your money goes', dir: 'budget' },
  fuel: { title: 'Theyo Fihaara: fuel shed system', dir: 'fuel' },
};

/** On a Gravity or Flow address: that product's title, icon, colour and install manifest (crawlers get them from gravity.html / flow.html). */
export function applyHostBranding() {
  if (ADMIN_HOST) {
    // The admin address is Super Admin only.
    document.title = 'OceanX Admin';
    if (!window.location.pathname.startsWith('/superadmin')) window.location.replace('/superadmin');
    return;
  }
  if (HOST_PRODUCT === 'pos') return;
  const b = BRANDING[HOST_PRODUCT];
  document.title = b.title;
  const set = (selector: string, attr: string, value: string) => document.querySelectorAll(selector).forEach((el) => el.setAttribute(attr, value));
  set('link[rel="manifest"]', 'href', `/${b.dir}.webmanifest`);
  set('link[rel="apple-touch-icon"]', 'href', `/${b.dir}/apple-touch-icon.png`);
  set('link[rel="icon"]', 'href', `/${b.dir}/icon-64.png`);
  set('meta[name="theme-color"]', 'content', '#03213a');
  document.documentElement.dataset.product = HOST_PRODUCT;
}

/** Navy/green colours (like Gravity's) while a Super Admin screen is open. */
export function useNavyPalette(active: boolean) {
  useEffect(() => {
    if (!active) return;
    document.documentElement.dataset.palette = 'navy';
    forceDark(true);
    return () => {
      delete document.documentElement.dataset.palette;
      forceDark(false);
    };
  }, [active]);
}

/**
 * The navy/green colours of Gravity and Gravity Flow while one of their screens is open (always on their own address).
 * Accepts a product, or `true` for Gravity (older callers).
 */
export function useProductTheme(product: Product | boolean) {
  const p = product === true ? 'gravity' : product === false ? 'pos' : product;
  useEffect(() => {
    if (p === 'pos' || HOST_PRODUCT !== 'pos') return;
    document.documentElement.dataset.product = p;
    return () => {
      delete document.documentElement.dataset.product;
    };
  }, [p]);
}
