import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function configuredOrigin(): string | null {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function withSecurityHeaders(response: NextResponse, origin: string | null): NextResponse {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Content-Security-Policy', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co");
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Vary', 'Origin');
  if (origin) response.headers.set('Access-Control-Allow-Origin', origin);
  return response;
}

export async function proxy(request: NextRequest) {
  const appOrigin = configuredOrigin();
  const requestOrigin = request.headers.get('origin');
  const isApi = request.nextUrl.pathname.startsWith('/api/');
  const isWebhook = request.nextUrl.pathname.startsWith('/api/webhooks/');
  const isCron = request.nextUrl.pathname === '/api/jobs/cron';

  if (
    isApi &&
    MUTATING_METHODS.has(request.method) &&
    !isWebhook &&
    !isCron &&
    requestOrigin &&
    requestOrigin !== request.nextUrl.origin &&
    requestOrigin !== appOrigin
  ) {
    return withSecurityHeaders(
      NextResponse.json({ error: 'Cross-origin request denied' }, { status: 403 }),
      appOrigin,
    );
  }

  if (request.method === 'OPTIONS' && isApi) {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
    return withSecurityHeaders(response, appOrigin);
  }

  const response = NextResponse.next({ request: { headers: request.headers } });
  if (isWebhook || isCron) return withSecurityHeaders(response, appOrigin);

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anonKey) {
      const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      });
      await supabase.auth.getUser();
    }
  } catch {
    // Route-level authentication remains authoritative.
  }

  return withSecurityHeaders(response, appOrigin);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
