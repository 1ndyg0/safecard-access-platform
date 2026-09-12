import { defineConfig, devices } from '@playwright/test';

/**
 * Real-database end-to-end configuration for the staff operations console.
 *
 * These tests intentionally use their own directory and configuration. They
 * exercise Route Handlers and PostgreSQL state enums against an isolated
 * Supabase database; they must never be pointed at a shared or production
 * project. The seed guard in e2e/fixtures/seed.ts enforces that boundary.
 */
const PORT = Number(process.env.ADMIN_E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /(queue|case-detail|accessibility)\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run start -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { NODE_ENV: 'production' },
      },
});
