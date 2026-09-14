import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // PGlite's first start (WASM compile, cold cache) can exceed vitest's 10 s default on a fresh checkout (Cycle Audit 1, FND-0019).
    hookTimeout: 60_000,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
