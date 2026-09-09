import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Performance suite. Separate from the functional E2E run because it
 * seeds several hundred cases and is slower; splitting it keeps the
 * correctness gate fast enough to run on every change.
 */
export default defineConfig({
  ...base,
  testDir: './perf',
  timeout: 120_000,
  projects: [{ name: 'performance', use: { ...devices['Desktop Chrome'] } }],
});
