import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The E2E seed truncates every table it knows about. That is correct for
 * a disposable database and catastrophic against the project the
 * application is wired to, so the guard that separates them is worth a
 * test of its own.
 *
 * Asserted statically because the seed itself only runs with an isolated
 * database configured, which is precisely the situation this guard
 * exists to prevent someone from faking.
 */
const SEED = readFileSync(join(process.cwd(), 'e2e/fixtures/seed.ts'), 'utf8');
const CODEX_CONFIG = readFileSync(join(process.cwd(), '.codex/config.toml'), 'utf8');

describe('E2E seed target guard', () => {
  it('refuses the project the application is configured against', () => {
    const configured = /project_ref=([a-z0-9]+)/.exec(CODEX_CONFIG)?.[1];
    expect(configured).toBeTruthy();
    // If the app is repointed at a new project, this test fails until
    // the denylist is updated too.
    expect(SEED).toContain(configured!);
    expect(SEED).toContain('NEVER_SEED_PROJECT_REFS');
  });

  it('does not let E2E_ALLOW_REMOTE override the denylist', () => {
    const guard = SEED.slice(
      SEED.indexOf('function assertDisposableTarget'),
      SEED.indexOf('export function createSeedClient'),
    );
    const denyIndex = guard.indexOf('NEVER_SEED_PROJECT_REFS');
    const allowIndex = guard.indexOf('E2E_ALLOW_REMOTE');
    expect(denyIndex).toBeGreaterThan(-1);
    expect(allowIndex).toBeGreaterThan(-1);
    // The denylist must be checked before the opt-out is honoured.
    expect(denyIndex).toBeLessThan(allowIndex);
  });

  it('requires an explicit opt-in for any non-local database', () => {
    expect(SEED).toContain("process.env.E2E_ALLOW_REMOTE === '1'");
    expect(SEED).toMatch(/Refusing to seed/);
  });

  it('still clears tables children-first, so the guard is load-bearing', () => {
    const order = SEED.slice(SEED.indexOf('TABLES_TO_CLEAR'), SEED.indexOf('async function clear'));
    expect(order.indexOf('payment_evidence')).toBeLessThan(order.indexOf('payment_intents'));
    expect(order.indexOf('recipient_cases')).toBeLessThan(order.indexOf('pilot_campaigns'));
  });
});
