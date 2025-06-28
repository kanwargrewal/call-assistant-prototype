import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/'];
  
  // Protected routes that require authentication but shouldn't redirect to dashboard
  const authOnlyRoutes = ['/onboarding'];
  
  // Check if the current path is a public route
  if (publicRoutes.includes(pathname)) {
    // If user has token and tries to access login/register, redirect to dashboard
    // But don't redirect if they came from onboarding or need onboarding
    if (token && (pathname === '/login' || pathname === '/register')) {
      const referer = request.headers.get('referer');
      const fromOnboarding = referer?.includes('/onboarding');
      
      // Don't redirect if coming from onboarding
      if (!fromOnboarding) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    return NextResponse.next();
  }

  // Allow access to onboarding for authenticated users
  if (authOnlyRoutes.includes(pathname)) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // Protected routes - require authentication
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 