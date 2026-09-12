import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertDataModeAllowed, LaunchGateError, resolveDataMode } from './data-mode';

const LIVE_ENV = {
  APP_ENVIRONMENT: 'production',
  NEXT_PUBLIC_DATA_MODE: 'live',
  LAUNCH_GATES_COMPLETE: 'true',
  ENABLE_OFFICIAL_PAYMENT_HANDOFF: 'true',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-key',
  NEXT_PUBLIC_APP_URL: 'https://safecard.example',
  SUPABASE_SERVICE_ROLE_KEY: 'server-secret',
  PAYMENT_PROOFS_BUCKET: 'payment-proofs',
  APPROVED_CAMPAIGN_ID: '11111111-1111-4111-8111-111111111111',
  APPROVED_CONTENT_VERSION: '1',
  AUDIT_HASH_SALT: 'a'.repeat(32),
  RATE_LIMIT_HASH_SALT: 'b'.repeat(32),
  MEMBER_SESSION_SECRET: 'c'.repeat(32),
  CRON_SECRET: 'd'.repeat(32),
} as const;

function stub(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

afterEach(() => vi.unstubAllEnvs());

describe('deployment data mode', () => {
  it('allows explicit synthetic mode in development', () => {
    stub({ APP_ENVIRONMENT: 'development', NEXT_PUBLIC_DATA_MODE: 'synthetic' });
    expect(resolveDataMode()).toBe('synthetic');
  });

  it('does not silently downgrade a production deployment', () => {
    stub({ APP_ENVIRONMENT: 'production', NEXT_PUBLIC_DATA_MODE: 'synthetic', LAUNCH_GATES_COMPLETE: 'false' });
    expect(() => resolveDataMode()).toThrow(LaunchGateError);
  });

  it('requires every server-side live setting', () => {
    stub({ ...LIVE_ENV, SUPABASE_SERVICE_ROLE_KEY: undefined });
    expect(() => resolveDataMode()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('accepts a complete production configuration', () => {
    stub(LIVE_ENV);
    expect(resolveDataMode()).toBe('live');
  });

  it('rejects a caller-selected mode that differs from deployment mode', () => {
    stub(LIVE_ENV);
    expect(() => assertDataModeAllowed('synthetic')).toThrow(/does not match/);
  });
});
