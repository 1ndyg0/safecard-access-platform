import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Invitation and recovery templates use a token hash instead of placing an
// access token in the browser fragment. The destination is fixed locally.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const failure = new URL('/admin/login?auth=invalid-link', request.nextUrl.origin);
  if (!tokenHash || !['invite', 'recovery'].includes(type ?? '')) {
    return NextResponse.redirect(failure);
  }
  try {
    const response = NextResponse.redirect(new URL('/admin/account', request.nextUrl.origin));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return NextResponse.redirect(failure);
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
    return error ? NextResponse.redirect(failure) : response;
  } catch {
    return NextResponse.redirect(failure);
  }
}
