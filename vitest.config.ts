import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', '.next', 'e2e', 'perf'],
  },
});
