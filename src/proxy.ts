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
    // An OAuth authorization (e.g. an MCP client asking to re-login) carries a
    // signed query; let it through so the flow can continue after sign-in.
    const isOAuthFlow = request.nextUrl.searchParams.has("sig");
    return hasSession && !isOAuthFlow
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
  matcher: ["/login", "/calendar/:path*", "/journal/:path*", "/search/:path*", "/settings/:path*", "/reports/:path*", "/repos/:path*"],
};
