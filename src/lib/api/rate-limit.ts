import 'server-only';

import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/db/client';

export class RateLimitError extends Error {
  constructor() {
    super('Too many requests. Please try again later.');
    this.name = 'RateLimitError';
  }
}

function requestAddress(request: NextRequest): string {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function enforceRateLimit(
  request: NextRequest,
  scope: string,
  limit = 10,
  windowSeconds = 60,
): Promise<void> {
  const salt = process.env.RATE_LIMIT_HASH_SALT;
  if ((!salt || salt.length < 32 || salt.startsWith('replace-with-')) && process.env.NODE_ENV === 'production') {
    throw new Error('RATE_LIMIT_HASH_SALT must be at least 32 characters in production');
  }

  const keyHash = createHash('sha256')
    .update(`${salt ?? 'local-development-only'}:${requestAddress(request)}`)
    .digest('hex');

  const { data, error } = await getSupabaseAdminClient().rpc('consume_rate_limit', {
    p_key_hash: keyHash,
    p_scope: scope,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Rate limiter unavailable');
    }
    return;
  }

  if (data !== true) throw new RateLimitError();
}
