// Next.js 16 renamed middleware.ts -> proxy.ts (same capabilities).
// Gate on Clerk session only here; the actual role check (admin vs
// sales_manager, staff vs customer) happens server-side in the
// relevant layout, where we can safely query Postgres.
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';

const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

type ProxyHandler = (req: NextRequest, event: NextFetchEvent) => Promise<Response | undefined | void> | Response | undefined | void;

async function buildProxy(): Promise<ProxyHandler> {
  if (!CLERK_ENABLED) {
    // Clerk not provisioned yet - fail open locally rather than breaking
    // the whole site, but still block /admin so nothing is left exposed.
    return async (req) => {
      if (req.nextUrl.pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/sign-in', req.url));
      }
      return NextResponse.next();
    };
  }
  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');
  const isProtectedRoute = createRouteMatcher(['/admin(.*)', '/account(.*)']);
  return clerkMiddleware(async (clerkAuth, req) => {
    if (isProtectedRoute(req)) await clerkAuth.protect();
    return NextResponse.next();
  }) as unknown as ProxyHandler;
}

const proxyPromise = buildProxy();

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const handler = await proxyPromise;
  return handler(req, event);
}

export const proxyConfig = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};
