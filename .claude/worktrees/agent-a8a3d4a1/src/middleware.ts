import { NextRequest, NextResponse } from 'next/server';

// Known bot User-Agents (must match rate-limiter.ts)
const BOT_USER_AGENTS = [
  'curl', 'wget', 'python-requests', 'python-urllib',
  'go-http-client', 'java/', 'libwww-perl',
];

function isBotUserAgent(ua: string | null): boolean {
  if (!ua) return true; // No User-Agent = block
  const uaLower = ua.toLowerCase();
  return BOT_USER_AGENTS.some(bot => uaLower.includes(bot));
}

export function middleware(request: NextRequest) {
  // Skip bot checks in development
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // Only apply to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ua = request.headers.get('user-agent');

  if (isBotUserAgent(ua)) {
    return NextResponse.json(
      { error: 'Acceso no permitido.' },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
