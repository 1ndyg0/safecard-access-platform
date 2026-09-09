/**
 * Session helpers for server-side auth context extraction.
 *
 * Handles both authenticated staff and anonymous recipient sessions.
 * Anonymous sessions use Supabase anonymous sign-in for low-friction
 * first use on shared Android phones with unreliable data.
 */

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { AuthContext } from './permissions';

function requirePublicEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/**
 * Get the Supabase client with the current user's session (for server components/actions).
 * This client is subject to RLS — it sees only what the user's policies allow.
 */
export async function getSessionClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Can fail in server components (read-only context).
            // Middleware handles session refresh for those cases.
          }
        },
      },
    }
  );
}

/**
 * Extract the current user's auth context.
 * Returns null if not authenticated.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const supabase = await getSessionClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return {
      userId: user.id,
      isAnonymous: user.is_anonymous ?? false,
      email: user.email,
    };
  } catch {
    // Authentication fails closed when the auth service is unavailable.
    // Protected routes must not turn an absent/invalid session into a 500.
    return null;
  }
}

/**
 * Require an authenticated session.
 * Throws if not authenticated.
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    throw new AuthError('Authentication required');
  }
  return ctx;
}

/**
 * Require a non-anonymous authenticated session (staff users).
 */
export async function requireStaffAuth(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.isAnonymous) {
    throw new AuthError('Staff authentication required. Anonymous sessions cannot access this resource.');
  }
  return ctx;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
