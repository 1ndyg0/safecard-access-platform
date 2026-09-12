import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const origin = request.nextUrl.origin;
  if (!code) return NextResponse.redirect(new URL('/?auth=invalid', origin));

  const supabase = await getSessionClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const requestedNext = request.nextUrl.searchParams.get('next');
  // Keep redirects on this application. The invitation flow needs only the
  // password setup destination; all other callbacks land on the home page.
  const next = requestedNext === '/admin/setup' ? requestedNext : '/';
  return NextResponse.redirect(new URL(error ? '/?auth=failed' : next, origin));
}
