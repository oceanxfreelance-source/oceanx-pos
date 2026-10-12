import { useEffect } from 'react';
import { forceDark } from './theme';
/**
 * Which product this web address serves. Gravity can have its own address (any host with "gravity" in it,
 * e.g. gravity.example.com or oceanx-gravity.vercel.app, or one listed in VITE_GRAVITY_HOSTS). There the app is
 * Gravity only: its own sign-in, sign-up, name, icon and install. The same accounts system serves both.
 */
export function isGravityHost(hostname: string): boolean {
  const extra = String(import.meta.env.VITE_GRAVITY_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const host = hostname.toLowerCase();
  return host.includes('gravity') || extra.includes(host);
}

/** Super Admin's own address (any host with "admin" in it, e.g. admin.oceanx.app or oceanx-admin.vercel.app). */
export function isAdminHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.includes('admin') && !host.includes('gravity');
}

export const ADMIN_HOST = typeof window !== 'undefined' && isAdminHost(window.location.hostname);

export const GRAVITY_HOST = typeof window !== 'undefined' && isGravityHost(window.location.hostname);

/** On a Gravity address: Gravity's title, icon, colour and install manifest (crawlers get them from gravity.html). */
export function applyHostBranding() {
  if (ADMIN_HOST) {
    // The admin address is Super Admin only.
    document.title = 'OceanX Admin';
    if (!window.location.pathname.startsWith('/superadmin')) window.location.replace('/superadmin');
    return;
  }
  if (!GRAVITY_HOST) return;
  document.title = 'Gravity: quotations & invoices';
  const set = (selector: string, attr: string, value: string) => document.querySelectorAll(selector).forEach((el) => el.setAttribute(attr, value));
  set('link[rel="manifest"]', 'href', '/gravity.webmanifest');
  set('link[rel="apple-touch-icon"]', 'href', '/gravity/apple-touch-icon.png');
  set('link[rel="icon"]', 'href', '/gravity/icon-64.png');
  set('meta[name="theme-color"]', 'content', '#03213a');
  document.documentElement.dataset.product = 'gravity';
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

/** Gravity's navy/green colours while a Gravity screen is open (always on a Gravity address). */
export function useProductTheme(gravity: boolean) {
  useEffect(() => {
    if (!gravity || GRAVITY_HOST) return;
    document.documentElement.dataset.product = 'gravity';
    return () => {
      delete document.documentElement.dataset.product;
    };
  }, [gravity]);
}
