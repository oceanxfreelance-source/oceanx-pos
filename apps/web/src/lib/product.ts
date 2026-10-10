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

export const GRAVITY_HOST = typeof window !== 'undefined' && isGravityHost(window.location.hostname);

/** On a Gravity address: Gravity's title, icon, colour and install manifest (crawlers get them from gravity.html). */
export function applyHostBranding() {
  if (!GRAVITY_HOST) return;
  document.title = 'Gravity: quotations & invoices';
  const set = (selector: string, attr: string, value: string) => document.querySelectorAll(selector).forEach((el) => el.setAttribute(attr, value));
  set('link[rel="manifest"]', 'href', '/gravity.webmanifest');
  set('link[rel="apple-touch-icon"]', 'href', '/gravity/apple-touch-icon.png');
  set('link[rel="icon"]', 'href', '/gravity/icon-64.png');
  set('meta[name="theme-color"]', 'content', '#4c1d95');
}
