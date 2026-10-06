import { defineConfig } from 'vitest/config';

// Unit tests only; browser end-to-end tests run with Playwright (`npm run e2e`).
export default defineConfig({ test: { include: ['src/**/*.test.{ts,tsx}'], passWithNoTests: true } });
