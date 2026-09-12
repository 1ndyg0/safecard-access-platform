/** Permit only the configured API/storage origin, including a disposable local stack. */
export function contentSecurityPolicy(supabaseUrl: string | undefined): string {
  let source = '';
  try {
    const url = new URL(supabaseUrl ?? '');
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!url.username && !url.password && (url.protocol === 'https:' || (url.protocol === 'http:' && loopback))) {
      source = ` ${url.origin}`;
    }
  } catch {
    // Missing or invalid configuration grants no external access.
  }
  return "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; frame-src 'self' blob:" + source + "; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:" + source + "; connect-src 'self'" + source;
}
