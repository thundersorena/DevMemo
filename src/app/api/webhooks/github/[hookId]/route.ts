import { NextResponse, type NextRequest } from "next/server";
import { handleDelivery } from "@/server/github/github.service";
import { verifyGitHubSignature } from "@/server/github/push";

// GitHub caps webhook payloads at 25 MB.
const MAX_BODY_BYTES = 25 * 1024 * 1024;

/**
 * POST /api/webhooks/github/:hookId
 * Configure on GitHub with content type `application/json` and the secret
 * shown in Settings. Subscribes to `push` (and answers `ping`).
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/webhooks/github/[hookId]">) {
  const { hookId } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/i.test(hookId)) {
    return NextResponse.json({ ok: false, message: "Unknown webhook" }, { status: 404 });
  }

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, message: "Payload too large" }, { status: 413 });
  }

  // The signature covers the exact raw bytes, so read the body as text
  // before any parsing.
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  try {
    const outcome = await handleDelivery({
      hookId,
      event: req.headers.get("x-github-event"),
      rawBody,
      verify: (secret) => verifyGitHubSignature(rawBody, signature, secret),
    });
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    console.error("[github-webhook] delivery failed", {
      hookId,
      delivery: req.headers.get("x-github-delivery"),
      error,
    });
    // 5xx lets GitHub show the failure; redelivery is safe because ingestion is idempotent.
    return NextResponse.json({ ok: false, message: "Internal error" }, { status: 500 });
  }
}
