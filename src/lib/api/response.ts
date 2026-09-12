/**
 * Shared API response helpers
 *
 * Consistent JSON response format across all endpoints.
 * Handles validation errors, auth errors, permission errors,
 * and unexpected errors with appropriate HTTP status codes.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from '@/lib/auth/session';
import { InvalidTransitionError } from '@/lib/state-machines';
import { RateLimitError } from '@/lib/api/rate-limit';
import { LaunchGateError } from '@/lib/safety/data-mode';
import { PaymentProofValidationError } from '@/lib/payment/evidence-validation';

export function success<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function validationError(error: ZodError) {
  return NextResponse.json(
    {
      error: 'Validation failed',
      details: error.flatten().fieldErrors,
    },
    { status: 400 }
  );
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized(message = 'Authentication required') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Permission denied') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = 'Resource not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function tooManyRequests(message = 'Too many requests') {
  return NextResponse.json({ error: message }, { status: 429 });
}

export function serverError(message = 'Internal server error') {
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Unified error handler for API routes.
 * Maps known error types to appropriate HTTP responses.
 */
export function handleApiError(error: unknown, context: string): NextResponse {
  if (error instanceof ZodError) {
    return validationError(error);
  }

  if (error instanceof AuthError) {
    if (error.message.includes('Staff')) {
      return forbidden(error.message);
    }
    return unauthorized(error.message);
  }

  if (error instanceof InvalidTransitionError) {
    return conflict(`Invalid state transition: ${error.message}`);
  }

  if (error instanceof RateLimitError) {
    return tooManyRequests(error.message);
  }

  if (error instanceof LaunchGateError) {
    return forbidden(error.message);
  }

  if (error instanceof PaymentProofValidationError) {
    return validationError(new ZodError([{ code: 'custom', path: ['file'], message: error.message }]));
  }

  if (error instanceof Error) {
    const msg = error.message;

    if (msg.includes('not found') || msg.includes('Not found')) {
      return notFound(msg);
    }
    if (msg.includes('Permission denied') || msg.includes('MFA')) {
      return forbidden(msg);
    }
    if (msg.includes('consent must be') || msg.includes('application must be')) {
      return conflict(msg);
    }
    if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('Idempotency key') || msg.includes('last privacy administrator')) {
      return conflict(msg);
    }
    if (msg.startsWith('Cannot ') || msg.includes(' requires ') || msg.includes(' does not match ') || msg.includes(' is not linked ')) {
      return conflict(msg);
    }
  }

  // Expected client, authorization, state, and launch-gate responses above
  // are handled outcomes. Logging them as server errors pollutes production
  // monitoring and can conceal an actual 5xx failure in routine 4xx traffic.
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`[API] ${context}: ${errorName}`);
  return serverError('An unexpected error occurred. Please try again.');
}
