import { NextResponse, type NextRequest } from "next/server";
import { handleProviderDelivery } from "@/server/git/provider-hooks.service";
import { isProvider } from "@/server/git/providers";

const MAX_BODY_BYTES = 25 * 1024 * 1024;

/**
 * POST /api/webhooks/gitlab/:hookId   (header X-Gitlab-Token)
 * POST /api/webhooks/bitbucket/:hookId (header X-Hub-Signature: sha256=…)
 * GitHub has its own routes; the static `github` segments take precedence.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/webhooks/[provider]/[hookId]">) {
  const { provider, hookId } = await ctx.params;
  if (!isProvider(provider) || !/^[a-z0-9]{10,40}$/i.test(hookId)) {
    return NextResponse.json({ ok: false, message: "Unknown webhook" }, { status: 404 });
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, message: "Payload too large" }, { status: 413 });
  }

  const rawBody = await req.text();
  try {
    const outcome = await handleProviderDelivery({ provider, hookId, rawBody, headers: req.headers });
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    console.error(`[${provider}-webhook] delivery failed`, { hookId, error });
    return NextResponse.json({ ok: false, message: "Internal error" }, { status: 500 });
  }
}
