import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Register page — always allow
  if (pathname === '/register') {
    return NextResponse.next();
  }
  
  // Home & other protected pages
  const isVerified = request.cookies.get('kc_verified')?.value === 'true';
  
  if (!isVerified) {
    return NextResponse.redirect(new URL('/verify', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/captain/:path*', '/admin/:path*', '/auction/:path*'],
};