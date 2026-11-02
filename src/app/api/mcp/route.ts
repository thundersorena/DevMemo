import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { requireMcpAuth } from "@better-auth/mcp";
import { NextResponse, type NextRequest } from "next/server";
import { authenticateToken, bearerToken } from "@/server/api-token.service";
import { auth, MCP_RESOURCE } from "@/server/auth";
import { createMcpServer } from "@/server/mcp/server";
import { getCurrentUserById } from "@/server/session";
import type { CurrentUser } from "@/server/session";

/**
 * MCP endpoint (Streamable HTTP, stateless).
 *
 * Two ways to authenticate:
 *  - OAuth 2.1 (Claude.ai, ChatGPT, Cursor, VS Code…): the client discovers
 *    DevMemo's authorization server from the 401 challenge, the user signs in
 *    and approves, and the client sends a JWT access token bound to this
 *    resource. Verified by Better Auth's requireMcpAuth.
 *  - Personal access token `dm_…` from Settings (CLIs, scripts, config files).
 *
 * Each request gets a fresh MCP server bound to the authenticated user.
 */

async function serve(req: Request, user: CurrentUser): Promise<Response> {
  const server = createMcpServer(user);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
    maxRequestBodySize: 1024 * 1024,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (error) {
    console.error("[mcp] request failed", error);
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null },
      { status: 500 },
    );
  } finally {
    void server.close().catch(() => undefined);
  }
}

function unauthorized(message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32001, message }, id: null },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="devmemo", error="invalid_token"' } },
  );
}

// OAuth path: verifies signature, issuer, audience (= MCP_RESOURCE) and expiry.
const oauthHandler = requireMcpAuth(
  auth,
  async (req, claims) => {
    const user = claims.sub ? await getCurrentUserById(claims.sub) : null;
    if (!user) return unauthorized("Unknown user");
    return serve(req, user);
  },
  { resource: MCP_RESOURCE },
);

async function handle(req: NextRequest): Promise<Response> {
  const token = bearerToken(req.headers);
  if (token?.startsWith("dm_")) {
    const user = await authenticateToken(token);
    return user ? serve(req, user) : unauthorized("Invalid or revoked token");
  }
  // No token, or an OAuth access token. Without a token, requireMcpAuth answers
  // 401 with an RFC 9728 challenge that starts the client's OAuth flow.
  return oauthHandler(req);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
