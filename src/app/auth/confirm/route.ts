import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient } from '@/lib/auth/session';

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
    const client = await getSessionClient();
    const { error } = await client.auth.verifyOtp({
      token_hash: tokenHash, type: type as 'invite' | 'recovery',
    });
    return NextResponse.redirect(error ? failure : new URL('/admin/account', request.nextUrl.origin));
  } catch {
    return NextResponse.redirect(failure);
  }
}
