import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Authentication Middleware for Newton Assignment AI
 *
 * Rules:
 * 1. Static files and API routes bypass middleware.
 * 2. Unauthenticated requests to protected dashboard routes are redirected to /login.
 * 3. Authenticated requests to /login are redirected to / (dashboard).
 * 4. Ensures zero redirect loops on / and /login.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('newton_session')?.value;
  const isAuthenticated = Boolean(sessionToken);

  // Handle login route
  if (pathname === '/login') {
    if (isAuthenticated) {
      // Authenticated users trying to access login are sent to dashboard
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Unauthenticated users can access login
    return NextResponse.next();
  }

  // Handle protected dashboard routes
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API endpoints)
     * - _next/static (static assets)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
