import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Invitation and recovery templates use a token hash instead of placing an
// access token in the browser fragment. The destination is fixed locally.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  // Relative Location keeps the exact requesting host. NextURL normalizes
  // loopback addresses to localhost, which otherwise loses host-only cookies.
  const redirect = (path: '/admin/account' | '/admin/login?auth=invalid-link') =>
    new NextResponse(null, { status: 303, headers: { Location: path } });
  const failure = () => redirect('/admin/login?auth=invalid-link');
  if (!tokenHash || !['invite', 'recovery'].includes(type ?? '')) {
    return failure();
  }
  try {
    const response = redirect('/admin/account');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return failure();
    // Attach session cookies to the actual redirect response. The first page
    // after an email link must receive the same session as the server verified.
    const client = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { error } = await client.auth.verifyOtp({
      token_hash: tokenHash, type: type as 'invite' | 'recovery',
    });
    return error ? failure() : response;
  } catch {
    return failure();
  }
}
