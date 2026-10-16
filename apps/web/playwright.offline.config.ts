// Gravity Budget offline test: needs the built app (npx vite build), served on budget.localhost.
import { defineConfig, devices } from '@playwright/test';
const API_PORT = 4100;
const WEB_PORT = 5175;
const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgres://oceanx:oceanx_dev@localhost:5432/oceanx_e2e';
export default defineConfig({
  testDir: './e2e-offline',
  workers: 1,
  timeout: 120_000,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: `http://budget.localhost:${WEB_PORT}`, launchOptions: { executablePath: '/opt/pw-browsers/chromium' } },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: [
    { command: 'npx tsx src/server.ts', cwd: '../api', port: API_PORT, reuseExistingServer: false,
      env: { NODE_ENV: 'development', PORT: String(API_PORT), DATABASE_URL: E2E_DB, MAIL_TRANSPORT: 'log', RATE_LIMIT_DISABLED: 'true', APP_URL: `http://localhost:${WEB_PORT}`, STORAGE_DIR: '/tmp/oceanx-e2e-storage' } },
    { command: `npx vite preview --port ${WEB_PORT} --strictPort --host 127.0.0.1`, url: `http://127.0.0.1:${WEB_PORT}`, reuseExistingServer: false, env: { API_URL: `http://localhost:${API_PORT}` } },
  ],
});
