import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "../db";
import { decryptSecret, encryptSecret } from "../crypto";
import { env } from "../env";
import { NotFoundError } from "../errors";
import { importCommits } from "../journal.service";
import { extractCommits, pushPayloadSchema, type AuthorIdentity } from "./push";

/**
 * GitHub integration: per-user webhook endpoints and push ingestion.
 * The ingestion path is GitHub → webhook route → this service → database.
 * No AI is involved.
 */

export type HookView = {
  id: string;
  url: string;
  onlyOwnCommits: boolean;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  lastDeliveryMessage: string | null;
  createdAt: string;
};

export function webhookUrl(hookId: string): string {
  return new URL(`/api/webhooks/github/${hookId}`, env().BETTER_AUTH_URL).toString();
}

function newSecret(): string {
  return randomBytes(32).toString("hex");
}

function toView(hook: {
  id: string;
  onlyOwnCommits: boolean;
  lastDeliveryAt: Date | null;
  lastDeliveryStatus: string | null;
  lastDeliveryMessage: string | null;
  createdAt: Date;
}): HookView {
  return {
    id: hook.id,
    url: webhookUrl(hook.id),
    onlyOwnCommits: hook.onlyOwnCommits,
    lastDeliveryAt: hook.lastDeliveryAt?.toISOString() ?? null,
    lastDeliveryStatus: hook.lastDeliveryStatus,
    lastDeliveryMessage: hook.lastDeliveryMessage,
    createdAt: hook.createdAt.toISOString(),
  };
}

// ─── Hook management ───────────────────────────────────────────────────────

export async function getHook(userId: string): Promise<HookView | null> {
  const hook = await db.gitHubHook.findUnique({ where: { userId } });
  return hook ? toView(hook) : null;
}

/** Creates the user's webhook endpoint (or returns the existing one). */
export async function createHook(userId: string): Promise<HookView> {
  const hook = await db.gitHubHook.upsert({
    where: { userId },
    create: { userId, secretEncrypted: encryptSecret(newSecret()) },
    update: {},
  });
  await ensureGitHubLogin(userId);
  return toView(hook);
}

export async function revealHookSecret(userId: string): Promise<string> {
  const hook = await db.gitHubHook.findUnique({ where: { userId }, select: { secretEncrypted: true } });
  if (!hook) throw new NotFoundError("Webhook not set up");
  return decryptSecret(hook.secretEncrypted);
}

/** Replaces the secret. Repositories using the old secret stop being accepted. */
export async function rotateHookSecret(userId: string): Promise<string> {
  const secret = newSecret();
  const { count } = await db.gitHubHook.updateMany({
    where: { userId },
    data: { secretEncrypted: encryptSecret(secret) },
  });
  if (count === 0) throw new NotFoundError("Webhook not set up");
  return secret;
}

export async function setOnlyOwnCommits(userId: string, onlyOwnCommits: boolean): Promise<void> {
  const { count } = await db.gitHubHook.updateMany({ where: { userId }, data: { onlyOwnCommits } });
  if (count === 0) throw new NotFoundError("Webhook not set up");
}

/** Removes the endpoint. Already imported commits are kept. */
export async function deleteHook(userId: string): Promise<void> {
  await db.gitHubHook.deleteMany({ where: { userId } });
}

// ─── Identity ──────────────────────────────────────────────────────────────

/**
 * Users who signed in before `githubLogin` was captured don't have it yet.
 * Fetch it once with their OAuth token. Best effort: failures are ignored
 * because email / noreply matching still works.
 */
async function ensureGitHubLogin(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { githubLogin: true } });
  if (!user || user.githubLogin) return;

  const account = await db.account.findFirst({
    where: { userId, providerId: "github" },
    select: { accessToken: true },
  });
  if (!account?.accessToken) return;

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "DevMemo",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const profile = (await res.json()) as { login?: unknown };
    if (typeof profile.login === "string") {
      await db.user.update({ where: { id: userId }, data: { githubLogin: profile.login } });
    }
  } catch {
    // ignore: network errors don't block hook creation
  }
}

async function loadIdentity(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      githubLogin: true,
      timezone: true,
      accounts: { where: { providerId: "github" }, select: { accountId: true }, take: 1 },
    },
  });
  const identity: AuthorIdentity = {
    githubLogin: user.githubLogin,
    githubId: user.accounts[0]?.accountId ?? null,
    emails: [user.email],
  };
  return { identity, timeZone: user.timezone || env().APP_TIMEZONE };
}

// ─── Delivery handling ─────────────────────────────────────────────────────

export type DeliveryOutcome = {
  status: number;
  body: { ok: boolean; message: string; imported?: number; duplicates?: number };
};

async function recordDelivery(hookId: string, status: "ok" | "ignored" | "error", message: string) {
  await db.gitHubHook.update({
    where: { id: hookId },
    data: {
      lastDeliveryAt: new Date(),
      lastDeliveryStatus: status,
      lastDeliveryMessage: message.slice(0, 500),
    },
  });
}

/**
 * Verifies and processes one webhook delivery.
 * `verify` is passed in so the route controls exactly which raw bytes are signed.
 */
export async function handleDelivery(input: {
  hookId: string;
  event: string | null;
  rawBody: string;
  verify: (secret: string) => boolean;
}): Promise<DeliveryOutcome> {
  const hook = await db.gitHubHook.findUnique({
    where: { id: input.hookId },
    select: { id: true, userId: true, secretEncrypted: true, onlyOwnCommits: true },
  });
  if (!hook) return { status: 404, body: { ok: false, message: "Unknown webhook" } };

  let secret: string;
  try {
    secret = decryptSecret(hook.secretEncrypted);
  } catch {
    await recordDelivery(hook.id, "error", "Stored secret cannot be decrypted. Rotate the secret in Settings.");
    return { status: 500, body: { ok: false, message: "Webhook misconfigured" } };
  }

  if (!input.verify(secret)) {
    await recordDelivery(hook.id, "error", "Invalid signature. Check the secret configured on GitHub.");
    return { status: 401, body: { ok: false, message: "Invalid signature" } };
  }

  if (input.event === "ping") {
    await recordDelivery(hook.id, "ok", "Ping received. Webhook is connected.");
    return { status: 200, body: { ok: true, message: "pong" } };
  }

  if (input.event !== "push") {
    const message = `Event "${input.event ?? "unknown"}" ignored. Only push events are used.`;
    await recordDelivery(hook.id, "ignored", message);
    return { status: 202, body: { ok: true, message } };
  }

  let json: unknown;
  try {
    json = JSON.parse(input.rawBody);
  } catch {
    await recordDelivery(hook.id, "error", "Payload is not JSON. Set content type to application/json.");
    return { status: 400, body: { ok: false, message: "Payload must be application/json" } };
  }

  const parsed = pushPayloadSchema.safeParse(json);
  if (!parsed.success) {
    await recordDelivery(hook.id, "error", "Unexpected push payload format.");
    return { status: 400, body: { ok: false, message: "Invalid push payload" } };
  }

  const { identity, timeZone } = await loadIdentity(hook.userId);
  const extracted = extractCommits(parsed.data, {
    timeZone,
    identity,
    onlyOwnCommits: hook.onlyOwnCommits,
  });

  if (extracted.kind === "ignored") {
    await recordDelivery(hook.id, "ignored", extracted.reason);
    return { status: 202, body: { ok: true, message: extracted.reason } };
  }

  const { imported, duplicates } = await importCommits(hook.userId, extracted.commits);
  const repo = parsed.data.repository.full_name;
  const parts = [`${imported} new commit${imported === 1 ? "" : "s"} from ${repo}`];
  if (duplicates) parts.push(`${duplicates} already stored`);
  if (extracted.skippedOtherAuthors) parts.push(`${extracted.skippedOtherAuthors} by other authors skipped`);
  const message = parts.join(", ");

  await recordDelivery(hook.id, "ok", message);
  return { status: 200, body: { ok: true, message, imported, duplicates } };
}
