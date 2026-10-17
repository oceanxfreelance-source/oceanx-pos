/**
 * Build for Vercel using the Build Output API (v3): the React SPA as static files and the Fastify API
 * as one Node.js function (`/api/*`). Run by Vercel as the project's build command; see docs/DEPLOY-VERCEL.md.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.vercel/output');
const func = path.join(out, 'functions/api.func');
rmSync(out, { recursive: true, force: true });
mkdirSync(func, { recursive: true });

// 1. Web app (typechecked) → static files.
execSync('npm run build -w @oceanx/web', { cwd: root, stdio: 'inherit' });
cpSync(path.join(root, 'apps/web/dist'), path.join(out, 'static'), { recursive: true, filter: (src) => !src.endsWith('.map') });

// 1b. Gravity's own address gets the same app with Gravity's title, icon, colour, install manifest and share preview.
writeFileSync(path.join(out, 'static/gravity.html'), gravityShell(readFileSync(path.join(out, 'static/index.html'), 'utf8')));
writeFileSync(path.join(out, 'static/flow.html'), flowShell(readFileSync(path.join(out, 'static/index.html'), 'utf8')));
writeFileSync(path.join(out, 'static/budget.html'), budgetShell(readFileSync(path.join(out, 'static/index.html'), 'utf8')));

// 2. API → single bundled function. Native argon2 bindings are copied next to it.
await build({
  entryPoints: [path.join(root, 'apps/api/src/serverless.ts')],
  outfile: path.join(func, 'index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: ['@node-rs/argon2', 'pg-native', 'pino-pretty'],
  banner: {
    js: "import { createRequire as __cr } from 'module'; import { fileURLToPath as __fu } from 'url'; import { dirname as __dn } from 'path'; const require = __cr(import.meta.url); const __filename = __fu(import.meta.url); const __dirname = __dn(__filename);",
  },
  logLevel: 'warning',
});
cpSync(path.join(root, 'apps/api/drizzle'), path.join(func, 'drizzle'), { recursive: true });
const nodeRs = path.join(root, 'node_modules/@node-rs');
for (const pkg of readdirSync(nodeRs).filter((p) => p.startsWith('argon2'))) {
  cpSync(path.join(nodeRs, pkg), path.join(func, 'node_modules/@node-rs', pkg), { recursive: true, dereference: true });
}
writeFileSync(path.join(func, 'package.json'), JSON.stringify({ type: 'module' }));
writeFileSync(
  path.join(func, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30, memory: 1024 }, null, 2),
);

// 3. Routing: API to the function, real files from static, everything else to the SPA.
writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      // Gravity: ended free trials (notice, then deletion when unpaid) are checked daily; the app also checks while in use.
      crons: [{ path: '/api/cron/trials', schedule: '15 3 * * *' }],
      routes: [
        // Pages and files: never framed by other sites (stops sign-in page clickjacking), no type sniffing.
        { src: '^/(?!api(?:/|$))(.*)$', headers: { 'x-frame-options': 'SAMEORIGIN', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' }, continue: true },
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '^/api(/.*)?$', dest: '/api' },
        // Phone apps: always the current Android build (the version in android/app/build.gradle, published as a GitHub release).
        ...appDownloadRoutes(),
        // Super Admin's own address (SUPERADMIN_APP_URL): it opens straight into Super Admin, and
        // /superadmin on the POS or Gravity addresses moves there (its API answers only there).
        ...adminRoutes(),
        // Gravity Flow's address (any host with "flow" in it), Gravity Budget's ("budget") and Gravity's ("gravity"): their own app shells.
        { src: '^/(?:index\\.html)?$', has: [{ type: 'host', value: '.*flow.*' }], dest: '/flow.html', headers: { 'cache-control': 'no-cache' } },
        { src: '^/(?:index\\.html)?$', has: [{ type: 'host', value: '.*budget.*' }], dest: '/budget.html', headers: { 'cache-control': 'no-cache' } },
        { src: '^/(?:index\\.html)?$', has: [{ type: 'host', value: gravityHostPattern() }], dest: '/gravity.html', headers: { 'cache-control': 'no-cache' } },
        { handle: 'filesystem' },
        { src: '^/(.*)$', has: [{ type: 'host', value: '.*flow.*' }], dest: '/flow.html', headers: { 'cache-control': 'no-cache' } },
        { src: '^/(.*)$', has: [{ type: 'host', value: '.*budget.*' }], dest: '/budget.html', headers: { 'cache-control': 'no-cache' } },
        { src: '^/(.*)$', has: [{ type: 'host', value: gravityHostPattern() }], dest: '/gravity.html', headers: { 'cache-control': 'no-cache' } },
        // The app shell must always be fresh so a new deploy is picked up on the next visit.
        { src: '^/(.*)$', dest: '/index.html', headers: { 'cache-control': 'no-cache' } },
      ],
    },
    null,
    2,
  ),
);
if (!existsSync(path.join(out, 'static/index.html'))) throw new Error('web build missing');
console.log('Vercel build output ready at .vercel/output');

function adminRoutes() {
  const url = (process.env.SUPERADMIN_APP_URL ?? '').replace(/\/$/, '');
  if (!url) return [];
  // Its own address, plus any older addresses that still serve Super Admin (SUPERADMIN_HOSTS).
  const hosts = [new URL(url).hostname, ...(process.env.SUPERADMIN_HOSTS ?? '').split(',')].map((h) => h.trim()).filter(Boolean);
  const host = `(?:${hosts.map((h) => h.replace(/\./g, '\\.')).join('|')})`;
  return [
    { src: '^/$', has: [{ type: 'host', value: host }], status: 308, headers: { Location: '/superadmin' } },
    { src: '^/superadmin(/.*)?$', missing: [{ type: 'host', value: host }], status: 308, headers: { Location: `${url}/superadmin$1` } },
    // OceanX Admin (Super Admin's phone app, payments only): offered only on Super Admin's own address.
    ...adminApkRoute(host),
  ];
}

function adminApkRoute(host) {
  const gradle = readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
  const v = gradle.match(/def adminVersion\s*=\s*'([^']+)'/)?.[1];
  if (!v) return [];
  const location = `https://github.com/oceanxfreelance-source/oceanx-pos/releases/download/admin-android-v${v}/OceanX-Admin-${v}.apk`;
  return [{ src: '^/download/admin\\.apk$', has: [{ type: 'host', value: host }], status: 302, headers: { location, 'cache-control': 'no-cache' } }];
}

/** Host pattern for Gravity's own address (kept in step with apps/web/src/lib/product.ts). */
function gravityHostPattern() {
  return '.*gravity.*';
}

/** index.html with Gravity's name, icons, theme colour, manifest and Open Graph tags. */
function gravityShell(html) {
  const title = 'Gravity: quotations & invoices';
  // Social previews need absolute URLs: Gravity's address comes from GRAVITY_APP_URL (also used by the API's e-mails).
  const base = (process.env.GRAVITY_APP_URL ?? '').replace(/\/$/, '');
  const desc = 'Quotations and invoices in English or Dhivehi for entrepreneurs, freelancers and small businesses. On your phone or PC.';
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${title.replace('&', '&amp;')}</title>`],
    [/<meta name="theme-color" content="[^"]*" \/>/, '<meta name="theme-color" content="#03213a" />'],
    [/<link rel="manifest" href="[^"]*" \/>/, '<link rel="manifest" href="/gravity.webmanifest" />'],
    [/<link rel="apple-touch-icon" href="[^"]*" \/>/, '<link rel="apple-touch-icon" href="/gravity/apple-touch-icon.png" />'],
    [/<link rel="icon" type="image\/png" sizes="32x32" href="[^"]*" \/>/, '<link rel="icon" type="image/png" sizes="32x32" href="/gravity/icon-64.png" />'],
    [/<link rel="icon" type="image\/png" sizes="192x192" href="[^"]*" \/>/, '<link rel="icon" type="image/png" sizes="192x192" href="/gravity/icon-192.png" />'],
    [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${desc}" />`],
    [/<meta property="og:site_name" content="[^"]*" \/>/, '<meta property="og:site_name" content="Gravity" />'],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title.replace('&', '&amp;')}" />`],
    [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${desc}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, base ? `<meta property="og:url" content="${base}/" />` : ''],
    [/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${base}/gravity/og-image.jpg" />`],
    [/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title.replace('&', '&amp;')}" />`],
    [/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${desc}" />`],
    [/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${base}/gravity/og-image.jpg" />`],
    [/<meta property="og:image:alt" content="[^"]*" \/>/, '<meta property="og:image:alt" content="Gravity: quotations and invoices" />'],
  ];
  let out = html;
  for (const [re, to] of swaps) {
    if (!re.test(out)) continue;
    out = out.replace(re, to);
  }
  return out.replace(/OceanX POS/g, 'Gravity');
}

/** index.html with Gravity Flow's name, icons, theme colour, manifest and Open Graph tags. */
function flowShell(html) {
  const title = 'Gravity Flow: income, expenses & profit';
  const base = (process.env.FLOW_APP_URL ?? '').replace(/\/$/, '');
  const desc = 'Income, expenses and profit for small businesses: see your daily and monthly profit, on your phone or PC.';
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${title.replace('&', '&amp;')}</title>`],
    [/<meta name="theme-color" content="[^"]*" \/>/, '<meta name="theme-color" content="#03213a" />'],
    [/<link rel="manifest" href="[^"]*" \/>/, '<link rel="manifest" href="/flow.webmanifest" />'],
    [/<link rel="apple-touch-icon" href="[^"]*" \/>/, '<link rel="apple-touch-icon" href="/flow/apple-touch-icon.png" />'],
    [/<link rel="icon" type="image\/png" sizes="32x32" href="[^"]*" \/>/, '<link rel="icon" type="image/png" sizes="32x32" href="/flow/icon-64.png" />'],
    [/<link rel="icon" type="image\/png" sizes="192x192" href="[^"]*" \/>/, '<link rel="icon" type="image/png" sizes="192x192" href="/flow/icon-192.png" />'],
    [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${desc}" />`],
    [/<meta property="og:site_name" content="[^"]*" \/>/, '<meta property="og:site_name" content="Gravity Flow" />'],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title.replace('&', '&amp;')}" />`],
    [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${desc}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, base ? `<meta property="og:url" content="${base}/" />` : ''],
    [/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${base}/flow/og-image.jpg" />`],
    [/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title.replace('&', '&amp;')}" />`],
    [/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${desc}" />`],
    [/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${base}/flow/og-image.jpg" />`],
    [/<meta property="og:image:alt" content="[^"]*" \/>/, '<meta property="og:image:alt" content="Gravity Flow: income, expenses and profit" />'],
  ];
  let out = html;
  for (const [re, to] of swaps) {
    if (!re.test(out)) continue;
    out = out.replace(re, to);
  }
  return out.replace(/OceanX POS/g, 'Gravity Flow');
}

/** index.html with Gravity Budget's name, icons, theme colour, manifest and Open Graph tags. */
function budgetShell(html) {
  const title = 'Gravity Budget: know where your money goes';
  const base = (process.env.BUDGET_APP_URL ?? '').replace(/\/$/, '');
  const desc = 'Know where your money goes: monthly budgets, bills and savings goals on your phone. 24 hours free, then MVR 50 a month.';
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${title.replace('&', '&amp;')}</title>`],
    [/<meta name="theme-color" content="[^"]*" \/>/, '<meta name="theme-color" content="#03213a" />'],
    [/<link rel="manifest" href="[^"]*" \/>/, '<link rel="manifest" href="/budget.webmanifest" />'],
    [/<link rel="apple-touch-icon" href="[^"]*" \/>/, '<link rel="apple-touch-icon" href="/budget/apple-touch-icon.png" />'],
    [/<link rel="icon" type="image\/png" sizes="32x32" href="[^"]*" \/>/, '<link rel="icon" type="image/png" sizes="32x32" href="/budget/icon-64.png" />'],
    [/<link rel="icon" type="image\/png" sizes="192x192" href="[^"]*" \/>/, '<link rel="icon" type="image/png" sizes="192x192" href="/budget/icon-192.png" />'],
    [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${desc}" />`],
    [/<meta property="og:site_name" content="[^"]*" \/>/, '<meta property="og:site_name" content="Gravity Budget" />'],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title.replace('&', '&amp;')}" />`],
    [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${desc}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, base ? `<meta property="og:url" content="${base}/" />` : ''],
    [/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${base}/budget/og-image.jpg" />`],
    [/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title.replace('&', '&amp;')}" />`],
    [/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${desc}" />`],
    [/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${base}/budget/og-image.jpg" />`],
    [/<meta property="og:image:alt" content="[^"]*" \/>/, '<meta property="og:image:alt" content="Gravity Budget: monthly budgets, bills and savings goals" />'],
  ];
  let out = html;
  for (const [re, to] of swaps) {
    if (!re.test(out)) continue;
    out = out.replace(re, to);
  }
  return out.replace(/OceanX POS/g, 'Gravity Budget');
}

/** /download/pos.apk, /download/gravity.apk, /download/flow.apk and /download/budget.apk → the APK of the app version in android/app/build.gradle. */
function appDownloadRoutes() {
  const gradle = readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
  const version = (name) => gradle.match(new RegExp(`def ${name}\\s*=\\s*'([^']+)'`))?.[1];
  const release = 'https://github.com/oceanxfreelance-source/oceanx-pos/releases/download';
  const apps = [
    ['pos', version('appVersion'), (v) => `${release}/android-v${v}/OceanX-POS-Tablet-${v}.apk`],
    ['gravity', version('gravityVersion'), (v) => `${release}/gravity-android-v${v}/Gravity-${v}.apk`],
    ['flow', version('flowVersion'), (v) => `${release}/flow-android-v${v}/Gravity-Flow-${v}.apk`],
    ['budget', version('budgetVersion'), (v) => `${release}/budget-android-v${v}/Gravity-Budget-${v}.apk`],
  ];
  return apps
    .filter(([, v]) => v)
    .map(([app, v, url]) => ({ src: `^/download/${app}\\.apk$`, status: 302, headers: { location: url(v), 'cache-control': 'no-cache' } }));
}
