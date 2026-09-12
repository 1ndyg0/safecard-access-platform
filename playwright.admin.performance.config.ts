import { defineConfig, devices } from '@playwright/test';
import base from './playwright.admin.config';

/** Staff-console scale checks run separately from correctness tests. */
export default defineConfig({
  ...base,
  testDir: './perf',
  timeout: 120_000,
  projects: [{ name: 'performance', use: { ...devices['Desktop Chrome'] } }],
});
