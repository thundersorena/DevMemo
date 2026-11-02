import { auth } from "@/server/auth";

/**
 * OAuth discovery at the site root, served by Better Auth:
 *  - /.well-known/oauth-protected-resource[/api/mcp]   (RFC 9728, the MCP resource)
 *  - /.well-known/oauth-authorization-server/api/auth  (RFC 8414 path insertion)
 *  - /.well-known/openid-configuration/api/auth
 * MCP clients start here after the 401 challenge from /api/mcp.
 *
 * Some clients look up the authorization server metadata without the issuer
 * path; those bare URLs are answered with the same document.
 */
const BARE_FALLBACKS: Record<string, string> = {
  "/.well-known/oauth-authorization-server": "/api/auth/.well-known/oauth-authorization-server",
  "/.well-known/openid-configuration": "/api/auth/.well-known/openid-configuration",
};

function handle(req: Request) {
  const url = new URL(req.url);
  const fallback = BARE_FALLBACKS[url.pathname.replace(/\/$/, "")];
  if (fallback) {
    url.pathname = fallback;
    return auth.handler(new Request(url, req));
  }
  return auth.handler(req);
}

export const GET = handle;
export const HEAD = handle;
