import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Integration tests share one PostgreSQL test database.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globalSetup: ['test/globalSetup.ts'],
  },
});
