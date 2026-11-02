import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "../db";
import { decryptSecret, encryptSecret } from "../crypto";
import { env } from "../env";
import { NotFoundError } from "../errors";
import { loadIdentity } from "../github/github.service";
import { extractCommits } from "../github/push";
import { importCommits } from "../journal.service";
import {
  parseBitbucketPush,
  parseGitLabPush,
  verifyBitbucketSignature,
  verifyGitLabToken,
  type Provider,
} from "./providers";

/** Manual webhooks for GitLab and Bitbucket. Same shape as the GitHub one. */

export type ProviderHookView = {
  provider: Provider;
  url: string;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  lastDeliveryMessage: string | null;
};

function hookUrl(provider: Provider, id: string): string {
  return new URL(`/api/webhooks/${provider}/${id}`, env().BETTER_AUTH_URL).toString();
}

export async function listProviderHooks(userId: string): Promise<Partial<Record<Provider, ProviderHookView>>> {
  const hooks = await db.providerHook.findMany({ where: { userId } });
  const result: Partial<Record<Provider, ProviderHookView>> = {};
  for (const h of hooks) {
    const provider = h.provider as Provider;
    result[provider] = {
      provider,
      url: hookUrl(provider, h.id),
      lastDeliveryAt: h.lastDeliveryAt?.toISOString() ?? null,
      lastDeliveryStatus: h.lastDeliveryStatus,
      lastDeliveryMessage: h.lastDeliveryMessage,
    };
  }
  return result;
}

export async function createProviderHook(userId: string, provider: Provider): Promise<void> {
  await db.providerHook.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, secretEncrypted: encryptSecret(randomBytes(32).toString("hex")) },
    update: {},
  });
}

export async function revealProviderSecret(userId: string, provider: Provider): Promise<string> {
  const hook = await db.providerHook.findUnique({ where: { userId_provider: { userId, provider } } });
  if (!hook) throw new NotFoundError("Webhook not set up");
  return decryptSecret(hook.secretEncrypted);
}

export async function rotateProviderSecret(userId: string, provider: Provider): Promise<string> {
  const secret = randomBytes(32).toString("hex");
  const { count } = await db.providerHook.updateMany({
    where: { userId, provider },
    data: { secretEncrypted: encryptSecret(secret) },
  });
  if (count === 0) throw new NotFoundError("Webhook not set up");
  return secret;
}

export async function deleteProviderHook(userId: string, provider: Provider): Promise<void> {
  await db.providerHook.deleteMany({ where: { userId, provider } });
}

// ─── Delivery ──────────────────────────────────────────────────────────────

async function record(id: string, status: "ok" | "ignored" | "error", message: string) {
  await db.providerHook.update({
    where: { id },
    data: { lastDeliveryAt: new Date(), lastDeliveryStatus: status, lastDeliveryMessage: message.slice(0, 500) },
  });
}

export async function handleProviderDelivery(input: {
  provider: Provider;
  hookId: string;
  rawBody: string;
  headers: Headers;
}): Promise<{ status: number; body: { ok: boolean; message: string } }> {
  const { provider, hookId, rawBody, headers } = input;
  const hook = await db.providerHook.findUnique({ where: { id: hookId } });
  if (!hook || hook.provider !== provider) return { status: 404, body: { ok: false, message: "Unknown webhook" } };

  let secret: string;
  try {
    secret = decryptSecret(hook.secretEncrypted);
  } catch {
    await record(hook.id, "error", "Stored secret cannot be decrypted. Rotate the secret in Settings.");
    return { status: 500, body: { ok: false, message: "Webhook misconfigured" } };
  }

  const verified =
    provider === "gitlab"
      ? verifyGitLabToken(headers.get("x-gitlab-token"), secret)
      : verifyBitbucketSignature(rawBody, headers.get("x-hub-signature"), secret);
  if (!verified) {
    const hint = provider === "gitlab" ? "Check the Secret token on GitLab." : "Check the Secret on Bitbucket.";
    await record(hook.id, "error", `Invalid ${provider === "gitlab" ? "token" : "signature"}. ${hint}`);
    return { status: 401, body: { ok: false, message: "Invalid signature" } };
  }

  // Bitbucket's "Test connection" and other non-push events.
  const event = provider === "gitlab" ? headers.get("x-gitlab-event") : headers.get("x-event-key");

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await record(hook.id, "error", "Payload is not JSON.");
    return { status: 400, body: { ok: false, message: "Payload must be JSON" } };
  }

  const parsed = provider === "gitlab" ? parseGitLabPush(event, payload) : parseBitbucketPush(event, payload);
  if (!parsed.ok) {
    await record(hook.id, "ignored", parsed.ignored);
    return { status: 202, body: { ok: true, message: parsed.ignored } };
  }

  const { identity, timeZone, onlyOwnCommits } = await loadIdentity(hook.userId);
  let imported = 0;
  let duplicates = 0;
  let skipped = 0;
  const repos = new Set<string>();
  for (const push of parsed.pushes) {
    const extracted = extractCommits(push, { timeZone, identity, onlyOwnCommits });
    if (extracted.kind !== "commits") continue;
    repos.add(push.repository.full_name);
    skipped += extracted.skippedOtherAuthors;
    const result = await importCommits(hook.userId, extracted.commits, provider);
    imported += result.imported;
    duplicates += result.duplicates;
  }

  const parts = [`${imported} new commit${imported === 1 ? "" : "s"}${repos.size ? ` from ${[...repos].join(", ")}` : ""}`];
  if (duplicates) parts.push(`${duplicates} already stored`);
  if (skipped) parts.push(`${skipped} by other authors skipped`);
  const message = parts.join(", ");
  await record(hook.id, "ok", message);
  return { status: 200, body: { ok: true, message } };
}
