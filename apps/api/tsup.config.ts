import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/db/migrate.ts', 'src/db/seed.ts', 'src/cli/create-superadmin.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Bundle the workspace package; keep real npm deps external.
  noExternal: ['@oceanx/shared'],
});
