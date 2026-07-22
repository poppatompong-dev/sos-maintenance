import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Integration tests (`*.itest.ts`) run against a REAL Postgres+PostGIS via
 * DATABASE_URL. Kept separate from the unit config so `pnpm test` stays DB-free
 * and fast; CI runs this in the dedicated `integration` job.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.itest.ts', 'prisma/**/*.itest.ts'],
    // Integration specs share a live DB; run files serially to avoid races.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
