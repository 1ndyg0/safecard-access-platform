import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './perf',
  timeout: 120_000,
  projects: [{ name: 'performance', use: { ...devices['Pixel 7'] } }],
});
