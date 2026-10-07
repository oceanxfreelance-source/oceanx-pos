/**
 * Build for Vercel using the Build Output API (v3): the React SPA as static files and the Fastify API
 * as one Node.js function (`/api/*`). Run by Vercel as the project's build command; see docs/DEPLOY-VERCEL.md.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
      routes: [
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '^/api(/.*)?$', dest: '/api' },
        { handle: 'filesystem' },
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
