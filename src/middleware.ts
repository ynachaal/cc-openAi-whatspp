import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { routing } from './i18n/routing';

export default async function middleware(request: any) {
  const pathname = request.nextUrl.pathname;
  
  // Handle internationalization
  const handleI18n = createMiddleware(routing);
  const i18nResponse = await handleI18n(request);
  
  // If the response is a redirect, return it immediately
  if (i18nResponse.status !== 200) {
    return i18nResponse;
  }

  // Check if the path starts with /dashboard
  if (pathname.startsWith('/dashboard')) {
    const token = await getToken({ req: request });
    
    // If no token or user is not an admin, redirect to sign in
    if (!token || token.role !== 'ADMIN') {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', request.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  return i18nResponse;
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};