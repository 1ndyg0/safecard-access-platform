import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration for application review and member corrections.
 *
 * The correction specs drive the real protected routes against a real
 * database. That is a deliberate requirement of this module rather than
 * a preference: a mocked route cannot prove that a member session is
 * confined to its own case, that a superseded submission is preserved,
 * that a duplicate correction is refused by a unique index, or that
 * expired consent stops a resubmission. Those are database behaviours.
 */

const PORT = Number(process.env.E2E_PORT ?? 3101);
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
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      // Applicants use this on a shared phone; the member journey is
      // re-run at 375px rather than assumed to scale.
      testMatch: /(member-correction|accessibility)\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run start -- --port ' + PORT,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NODE_ENV: 'production' },
  },
});
