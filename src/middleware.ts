import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Public routes that do not require owner session authentication:
export function isAllowlistedPath(pathname: string): boolean {
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/order-return" ||
    pathname === "/order-cancel" ||
    pathname === "/checkout-landing" ||
    pathname === "/healthz" ||
    pathname === "/readyz" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/webhooks/paypal" ||
    pathname === "/api/warmup" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") // static assets like favicon.ico, transition.mp4, images
  ) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allowlist check: public landing, login, public webhooks, static assets
  if (isAllowlistedPath(pathname)) {
    return NextResponse.next();
  }

  // Edge-safe verification: check session cookie before granting access to protected routes
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    // For protected API endpoints, return 401 Unauthorized
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Unauthorized: Owner session required" },
        { status: 401 }
      );
    }

    // For protected dashboard and merchant pages, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
