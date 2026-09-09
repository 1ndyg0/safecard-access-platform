import { defineConfig, devices } from '@playwright/test';

/**
 * Reconciled end-to-end config.
 *
 * From the payment/storyboards branch: the `tests/e2e` location and the
 * five-browser matrix, which is what "serious and critical axe checks
 * across the browser matrix" actually requires.
 * From this module: the production server (a dev-server build hides
 * bundling and caching differences that matter to LCP), and a
 * `webServer` that builds nothing implicitly.
 *
 * There is deliberately no `networkidle` usage anywhere in this suite:
 * the storyboard emits telemetry while a person reads it, so network
 * idle may never arrive, and waiting for it would hang on correct
 * behaviour.
 */

const PORT = Number(process.env.E2E_PORT ?? 3102);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run start -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
});
