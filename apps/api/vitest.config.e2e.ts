import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // PGlite's first start (WASM compile, cold cache) can exceed vitest's 10 s default on a fresh checkout (Cycle Audit 1, FND-0019).
    hookTimeout: 60_000,
    // The suites delete rows: never against a database that is not named *_test (Cycle Audit 3).
    setupFiles: ['./test/database-guard.ts'],
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
