import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PushPayload } from "../github/push";

export const PROVIDERS = ["gitlab", "bitbucket"] as const;
export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** GitLab sends the secret verbatim in `X-Gitlab-Token`. */
export function verifyGitLabToken(header: string | null, secret: string): boolean {
  return Boolean(header) && safeEqual(header!, secret);
}

const gitlabPushSchema = z.object({
  object_kind: z.literal("push"),
  ref: z.string(),
  after: z.string(),
  project: z.object({
    id: z.union([z.number(), z.string()]),
    path_with_namespace: z.string(),
  }),
  commits: z
    .array(
      z.object({
        id: z.string(),
        message: z.string(),
        timestamp: z.string(),
        url: z.string(),
        author: z.object({ name: z.string().nullish(), email: z.string().nullish() }).nullish(),
      }),
    )
    .default([]),
});

const ZERO_SHA = /^0+$/;

export type ParseResult = { ok: true; pushes: PushPayload[] } | { ok: false; ignored: string };

/**
 * GitLab "Push Hook". GitLab includes at most the 20 most recent commits of
 * a push; that's what gets imported.
 */
export function parseGitLabPush(event: string | null, payload: unknown): ParseResult {
  if (event !== "Push Hook") return { ok: false, ignored: `Event "${event ?? "unknown"}" ignored. Only push events are used.` };
  const parsed = gitlabPushSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, ignored: "Unexpected push payload format." };
  const p = parsed.data;
  return {
    ok: true,
    pushes: [
      {
        ref: p.ref,
        deleted: ZERO_SHA.test(p.after),
        repository: { id: `gitlab:${p.project.id}`, full_name: p.project.path_with_namespace },
        commits: p.commits.map((c) => ({
          id: c.id,
          message: c.message,
          timestamp: c.timestamp,
          url: c.url,
          author: { name: c.author?.name ?? null, email: c.author?.email ?? null, username: null },
          committer: null,
        })),
      },
    ],
  };
}

/** Bitbucket Cloud signs with HMAC-SHA256 in `X-Hub-Signature: sha256=<hex>`. */
export function verifyBitbucketSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeEqual(header.slice("sha256=".length).toLowerCase(), expected);
}

const bitbucketCommitSchema = z.object({
  hash: z.string(),
  message: z.string(),
  date: z.string(),
  author: z
    .object({
      raw: z.string().nullish(),
      user: z.object({ nickname: z.string().nullish() }).nullish(),
    })
    .nullish(),
  links: z.object({ html: z.object({ href: z.string() }) }),
});

const bitbucketPushSchema = z.object({
  repository: z.object({ uuid: z.string(), full_name: z.string() }),
  push: z.object({
    changes: z.array(
      z.object({
        new: z.object({ type: z.string(), name: z.string() }).nullish(),
        old: z.object({ type: z.string(), name: z.string() }).nullish(),
        closed: z.boolean().optional(),
        commits: z.array(bitbucketCommitSchema).default([]),
      }),
    ),
  }),
});

export function parseRawAuthor(raw: string | null | undefined): { name: string | null; email: string | null } {
  if (!raw) return { name: null, email: null };
  const match = /^(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  return match ? { name: match[1] || null, email: match[2] } : { name: raw, email: null };
}

/**
 * Bitbucket "repo:push". One push can update several branches (changes).
 * Bitbucket includes only a few recent commits per change in the webhook.
 */
export function parseBitbucketPush(event: string | null, payload: unknown): ParseResult {
  if (event !== "repo:push") return { ok: false, ignored: `Event "${event ?? "unknown"}" ignored. Only repo:push is used.` };
  const parsed = bitbucketPushSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, ignored: "Unexpected push payload format." };
  const { repository, push } = parsed.data;

  const pushes: PushPayload[] = push.changes.map((change) => {
    const branch = change.new ?? change.old;
    const isBranch = branch?.type === "branch";
    return {
      ref: isBranch ? `refs/heads/${branch!.name}` : `refs/tags/${branch?.name ?? "unknown"}`,
      deleted: !change.new || change.closed === true,
      repository: { id: `bitbucket:${repository.uuid}`, full_name: repository.full_name },
      commits: change.commits.map((c) => {
        const author = parseRawAuthor(c.author?.raw);
        return {
          id: c.hash,
          message: c.message,
          timestamp: c.date,
          url: c.links.html.href,
          author: { ...author, username: c.author?.user?.nickname ?? null },
          committer: null,
        };
      }),
    };
  });
  return { ok: true, pushes };
}
