/**
 * Pure helpers for GitHub push webhooks: signature verification, payload
 * parsing, author matching and commit extraction. No database or Next.js
 * imports, so this module is unit-tested directly.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { dateKeyInTimeZone, type DateKey } from "@/lib/dates";

// ─── Signature ─────────────────────────────────────────────────────────────

/**
 * Verifies `X-Hub-Signature-256` (`sha256=<hex>`) against the raw body.
 * Constant-time comparison; returns false for any malformed input.
 */
export function verifyGitHubSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const received = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// ─── Payload ───────────────────────────────────────────────────────────────

const personSchema = z
  .object({
    name: z.string().nullish(),
    email: z.string().nullish(),
    username: z.string().nullish(),
  })
  .nullish();

const commitSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{7,64}$/i),
  message: z.string(),
  timestamp: z.string(),
  url: z.url(),
  distinct: z.boolean().optional(),
  author: personSchema,
  committer: personSchema,
});

export const pushPayloadSchema = z.object({
  ref: z.string(),
  deleted: z.boolean().optional(),
  repository: z.object({
    id: z.union([z.number(), z.string()]),
    full_name: z.string(),
  }),
  commits: z.array(commitSchema).default([]),
});

export type PushPayload = z.infer<typeof pushPayloadSchema>;
export type PushCommit = z.infer<typeof commitSchema>;

// ─── Author matching ───────────────────────────────────────────────────────

export type AuthorIdentity = {
  githubLogin: string | null;
  /** Numeric GitHub user id (from the OAuth account), as a string. */
  githubId: string | null;
  emails: string[];
};

/**
 * True when a commit was authored by this user. Matches on GitHub username,
 * known emails, and GitHub noreply addresses (`{id}+{login}@users.noreply.github.com`).
 */
export function isOwnCommit(commit: PushCommit, identity: AuthorIdentity): boolean {
  const author = commit.author;
  if (!author) return false;

  const login = identity.githubLogin?.toLowerCase();
  if (login && author.username?.toLowerCase() === login) return true;

  const email = author.email?.toLowerCase();
  if (!email) return false;
  if (identity.emails.some((e) => e.toLowerCase() === email)) return true;

  const noreply = /^(?:(\d+)\+)?([^@]+)@users\.noreply\.github\.com$/.exec(email);
  if (noreply) {
    const [, id, name] = noreply;
    if (id && identity.githubId && id === identity.githubId) return true;
    if (login && name.toLowerCase() === login) return true;
  }
  return false;
}

// ─── Extraction ────────────────────────────────────────────────────────────

export type CommitInput = {
  sha: string;
  date: DateKey;
  repositoryId: string;
  repositoryName: string;
  message: string;
  branch: string | null;
  url: string;
  authorName: string | null;
  authorEmail: string | null;
  committedAt: Date;
};

export type ExtractResult =
  | { kind: "ignored"; reason: string }
  | { kind: "commits"; commits: CommitInput[]; skippedOtherAuthors: number };

const MAX_MESSAGE_LENGTH = 10_000;

/**
 * Turns a push payload into commit records for one user.
 * The journal date comes from the commit's own timestamp in the user's
 * timezone, never from the delivery time.
 */
export function extractCommits(
  payload: PushPayload,
  options: { timeZone: string; identity: AuthorIdentity; onlyOwnCommits: boolean },
): ExtractResult {
  if (payload.deleted) return { kind: "ignored", reason: "Branch deleted" };
  if (!payload.ref.startsWith("refs/heads/")) {
    return { kind: "ignored", reason: `Not a branch push (${payload.ref})` };
  }
  const branch = payload.ref.slice("refs/heads/".length);

  const commits: CommitInput[] = [];
  let skippedOtherAuthors = 0;
  const seen = new Set<string>();

  for (const commit of payload.commits) {
    const sha = commit.id.toLowerCase();
    if (seen.has(sha)) continue;
    seen.add(sha);

    if (options.onlyOwnCommits && !isOwnCommit(commit, options.identity)) {
      skippedOtherAuthors++;
      continue;
    }
    const committedAt = new Date(commit.timestamp);
    if (Number.isNaN(committedAt.getTime())) continue;

    commits.push({
      sha,
      date: dateKeyInTimeZone(committedAt, options.timeZone),
      repositoryId: String(payload.repository.id),
      repositoryName: payload.repository.full_name,
      message: commit.message.slice(0, MAX_MESSAGE_LENGTH),
      branch,
      url: commit.url,
      authorName: commit.author?.name ?? null,
      authorEmail: commit.author?.email ?? null,
      committedAt,
    });
  }

  return { kind: "commits", commits, skippedOtherAuthors };
}
