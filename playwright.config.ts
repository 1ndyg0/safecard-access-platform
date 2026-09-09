import { defineConfig, devices } from '@playwright/test';

/**
 * Storyboard end-to-end configuration.
 *
 * Note the absence of `networkidle` anywhere in this suite. The page
 * emits telemetry while someone reads it, so network idle may never be
 * reached; readiness is asserted on the storyboard being visible, which
 * is what a reader actually waits for.
 */

const PORT = Number(process.env.E2E_PORT ?? 3102);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // A low-cost Android phone is the representative device here.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run start -- --port ' + PORT,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NODE_ENV: 'production' },
  },
});
