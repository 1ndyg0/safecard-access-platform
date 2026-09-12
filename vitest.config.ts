import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Reconciled unit-test config.
 *
 * From the payment/storyboards branch: the node environment, the `@`
 * alias, and `.tsx` coverage.
 * From this module: an explicit exclude for the Playwright suites, so a
 * future `.test.ts` under e2e/ or tests/ cannot be picked up here and
 * fail on Playwright imports.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'tests', 'e2e', 'perf'],
  },
  resolve: {
    alias: {
      // fileURLToPath rather than __dirname: this file is ESM, and
      // __dirname made Vite warn on every run.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` is a Next.js compile-time guard. Unit tests execute
      // server modules directly, so they use a deliberately empty shim.
      'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)),
    },
  },
});
