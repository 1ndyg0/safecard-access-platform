import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration for the operations console.
 *
 * These specs drive the real Next.js server and the real Route
 * Handlers. They do not intercept `/api/admin/**`: the module's whole
 * risk surface is server-side authorization and SQL against five
 * PostgreSQL enum types, and a mocked route proves none of it. A stubbed
 * response cannot raise `invalid input value for enum`, cannot enforce a
 * campaign scope and cannot suppress a cohort.
 *
 * They therefore require an isolated database, seeded by
 * e2e/fixtures/seed.ts and pointed at by E2E_SUPABASE_URL. Running them
 * against a shared or production project is refused by the seed guard.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
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
    // The console is staff-facing on desktop, but reviewers work from
    // phones in the field, so the mobile project below re-runs the
    // layout-sensitive specs at 375px.
    viewport: { width: 1280, height: 900 },
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /(queue|case-detail|accessibility)\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'npm run start -- --port ' + PORT,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: 'production',
    },
  },
});
