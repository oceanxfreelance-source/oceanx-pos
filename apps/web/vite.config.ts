import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

// The newest phone app of each product (android/app/build.gradle), so an older installed app can offer the update.
const gradle = (() => {
  try {
    return readFileSync(new URL('../../android/app/build.gradle', import.meta.url), 'utf8');
  } catch {
    return '';
  }
})();
const appVersion = (name: string) => gradle.match(new RegExp(`def ${name}\\s*=\\s*'([^']+)'`))?.[1] ?? '';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:4000', changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:4000', changeOrigin: false } },
  },
  build: { sourcemap: true },
  // Each product's own address (from the server's settings), for links shown in Super Admin.
  define: {
    __ANDROID_VERSIONS__: JSON.stringify({ gravity: appVersion('gravityVersion'), flow: appVersion('flowVersion'), budget: appVersion('budgetVersion') }),
    __APP_URLS__: JSON.stringify({ pos: process.env.APP_URL ?? '', gravity: process.env.GRAVITY_APP_URL ?? '', flow: process.env.FLOW_APP_URL ?? '', budget: process.env.BUDGET_APP_URL ?? '', fuel: process.env.FUEL_APP_URL ?? '' }),
  },
});
