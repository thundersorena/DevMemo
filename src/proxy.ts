import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic redirect only: checks that a session cookie exists.
 * Real authorization happens in requireUser() / the API helpers,
 * which validate the session against the database.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (pathname === "/login") {
    return hasSession
      ? NextResponse.redirect(new URL("/calendar", request.url))
      : NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // "/" is the public landing page and is intentionally not matched.
  matcher: ["/login", "/calendar/:path*", "/journal/:path*", "/search/:path*", "/settings/:path*"],
};
