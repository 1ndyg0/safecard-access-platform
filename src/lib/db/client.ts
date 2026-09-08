/**
 * Supabase client configuration
 *
 * Server-only service-role client. Browser and user-session clients live in
 * separate modules so this key cannot be pulled into a client dependency graph.
 */

import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Environment validation
// ============================================================

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. ` +
      `Copy .env.example to .env.local and fill in your Supabase credentials.`
    );
  }
  return value;
}

// ============================================================
// Admin client (server-side ONLY — bypasses RLS)
// NEVER expose service role key to the browser
// ============================================================

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Admin client must not be used in browser context. ' +
      'The service role key bypasses RLS and must stay server-side.'
    );
  }

  if (adminClient) return adminClient;

  adminClient = createClient(
    getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return adminClient;
}
