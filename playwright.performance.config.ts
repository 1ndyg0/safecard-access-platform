import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Performance suite. Split from the correctness run because it measures
 * timings, which are meaningless in parallel across five browsers.
 * A low-cost Android phone is the representative device.
 */
export default defineConfig({
  ...base,
  testDir: './tests/perf',
  timeout: 120_000,
  projects: [{ name: 'performance', use: { ...devices['Pixel 5'] } }],
});
