import { after, NextResponse, type NextRequest } from "next/server";
import { githubApp } from "@/server/env";
import { backfillRepositories, handleAppEvent } from "@/server/github/app.service";
import { verifyGitHubSignature } from "@/server/github/push";

export const maxDuration = 60;

const MAX_BODY_BYTES = 25 * 1024 * 1024;

/**
 * POST /api/webhooks/github-app
 * The single webhook of the DevMemo GitHub App (push, installation,
 * installation_repositories). Signed with GITHUB_APP_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const app = githubApp();
  if (!app) return NextResponse.json({ ok: false, message: "GitHub App not configured" }, { status: 404 });

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, message: "Payload too large" }, { status: 413 });
  }

  const rawBody = await req.text();
  if (!verifyGitHubSignature(rawBody, req.headers.get("x-hub-signature-256"), app.webhookSecret)) {
    return NextResponse.json({ ok: false, message: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, message: "Payload must be application/json" }, { status: 400 });
  }

  try {
    const result = await handleAppEvent(req.headers.get("x-github-event"), payload);
    if (result.backfill?.length) {
      const ids = result.backfill;
      after(() => backfillRepositories(ids));
    }
    return NextResponse.json({ ok: result.status < 400, message: result.message }, { status: result.status });
  } catch (error) {
    console.error("[github-app] webhook failed", { delivery: req.headers.get("x-github-delivery"), error });
    return NextResponse.json({ ok: false, message: "Internal error" }, { status: 500 });
  }
}
