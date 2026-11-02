import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse, type NextRequest } from "next/server";
import { authenticateToken, bearerToken } from "@/server/api-token.service";
import { createMcpServer } from "@/server/mcp/server";

/**
 * MCP endpoint (Streamable HTTP, stateless).
 * Auth: `Authorization: Bearer dm_…` personal access token from Settings.
 * Each request gets a fresh server bound to the token's user, so there is no
 * shared session state between users or requests.
 */

function unauthorized(message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32001, message }, id: null },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="devmemo"' } },
  );
}

async function handle(req: NextRequest): Promise<Response> {
  const token = bearerToken(req.headers);
  if (!token) return unauthorized("Missing bearer token. Create one in DevMemo Settings.");

  const user = await authenticateToken(token);
  if (!user) return unauthorized("Invalid or revoked token");

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
    // Stateless: nothing to keep after the response is produced.
    void server.close().catch(() => undefined);
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
