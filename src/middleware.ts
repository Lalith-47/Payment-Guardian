import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Public routes that do not require owner session authentication:
// 1. /api/auth/*: Better-auth endpoints (login, register, session)
// 2. /api/webhooks/paypal: PayPal webhook callback (authenticated cryptographically via signature)
// 3. /healthz: Liveness probe
// 4. /readyz: Readiness probe
export function isAllowlistedPath(pathname: string): boolean {
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/api/webhooks/paypal" ||
    pathname === "/healthz" ||
    pathname === "/readyz"
  ) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Allowlist check
  if (isAllowlistedPath(pathname)) {
    return NextResponse.next();
  }

  // Enforce Owner Session on all other /api routes
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized: Owner session required" },
        { status: 401 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Unauthorized: Session verification failed" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
