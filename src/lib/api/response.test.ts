import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/rate-limit', () => ({
  RateLimitError: class RateLimitError extends Error {},
}));
vi.mock('@/lib/auth/session', () => ({
  AuthError: class AuthError extends Error {},
}));
vi.mock('@/lib/safety/data-mode', () => ({
  LaunchGateError: class LaunchGateError extends Error {},
}));
vi.mock('@/lib/payment/evidence-validation', () => ({
  PaymentProofValidationError: class PaymentProofValidationError extends Error {},
}));

import { AuthError } from '@/lib/auth/session';
import { handleApiError } from './response';

describe('handleApiError logging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not report an expected authentication failure as a server error', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = handleApiError(new AuthError('Authentication required'), 'Protected route');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' });
    expect(logged).not.toHaveBeenCalled();
  });

  it('logs an unexpected failure without exposing its message', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = handleApiError(new Error('private database detail'), 'Protected route');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'An unexpected error occurred. Please try again.',
    });
    expect(logged).toHaveBeenCalledWith('[API] Protected route: Error');
  });
});
