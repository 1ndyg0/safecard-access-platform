import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const origin = request.nextUrl.origin;
  if (!code) return NextResponse.redirect(new URL('/?auth=invalid', origin));

  const supabase = await getSessionClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? '/?auth=failed' : '/', origin));
}
