import { defineConfig } from 'vitest/config';

/**
 * Unit tests only. The Playwright suites under e2e/ and perf/ also use
 * `.spec.ts`, and vitest's default glob would otherwise try to run them
 * and fail on the Playwright imports.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', '.next', 'e2e', 'perf'],
  },
});
