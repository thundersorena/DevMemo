import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  extractCommits,
  isOwnCommit,
  pushPayloadSchema,
  verifyGitHubSignature,
  type AuthorIdentity,
  type PushCommit,
} from "./push";

const SECRET = "test-secret";
const sign = (body: string, secret = SECRET) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

describe("verifyGitHubSignature", () => {
  const body = JSON.stringify({ hello: "world" });

  it("accepts a valid signature", () => {
    expect(verifyGitHubSignature(body, sign(body), SECRET)).toBe(true);
  });
  it("rejects a wrong secret", () => {
    expect(verifyGitHubSignature(body, sign(body, "other"), SECRET)).toBe(false);
  });
  it("rejects a modified body", () => {
    expect(verifyGitHubSignature(body + " ", sign(body), SECRET)).toBe(false);
  });
  it("rejects missing or malformed headers", () => {
    expect(verifyGitHubSignature(body, null, SECRET)).toBe(false);
    expect(verifyGitHubSignature(body, "sha1=abc", SECRET)).toBe(false);
    expect(verifyGitHubSignature(body, "sha256=zz", SECRET)).toBe(false);
    expect(verifyGitHubSignature(body, "sha256=", SECRET)).toBe(false);
  });
});

const me: AuthorIdentity = { githubLogin: "pouya", githubId: "12345", emails: ["pouya@example.com"] };

function commit(overrides: Partial<PushCommit> = {}): PushCommit {
  return {
    id: "a".repeat(40),
    message: "Fix webhook auth",
    timestamp: "2026-11-02T10:00:00+00:00",
    url: "https://github.com/acme/api/commit/aaaa",
    author: { name: "Pouya", email: "pouya@example.com", username: "pouya" },
    committer: null,
    ...overrides,
  };
}

describe("isOwnCommit", () => {
  it("matches by username (case-insensitive)", () => {
    expect(isOwnCommit(commit({ author: { username: "Pouya", email: "x@y.z" } }), me)).toBe(true);
  });
  it("matches by email", () => {
    expect(isOwnCommit(commit({ author: { email: "POUYA@example.com" } }), me)).toBe(true);
  });
  it("matches GitHub noreply addresses by id or login", () => {
    expect(isOwnCommit(commit({ author: { email: "12345+renamed@users.noreply.github.com" } }), me)).toBe(true);
    expect(isOwnCommit(commit({ author: { email: "pouya@users.noreply.github.com" } }), me)).toBe(true);
  });
  it("rejects other authors", () => {
    expect(isOwnCommit(commit({ author: { username: "someone", email: "someone@example.com" } }), me)).toBe(false);
    expect(isOwnCommit(commit({ author: { email: "999+someone@users.noreply.github.com" } }), me)).toBe(false);
    expect(isOwnCommit(commit({ author: null }), me)).toBe(false);
  });
});

function payload(overrides: Record<string, unknown> = {}) {
  return pushPayloadSchema.parse({
    ref: "refs/heads/main",
    repository: { id: 42, full_name: "acme/api" },
    commits: [commit()],
    ...overrides,
  });
}

describe("extractCommits", () => {
  const options = { timeZone: "UTC", identity: me, onlyOwnCommits: true };

  it("extracts commit metadata", () => {
    const result = extractCommits(payload(), options);
    expect(result).toMatchObject({ kind: "commits", skippedOtherAuthors: 0 });
    if (result.kind !== "commits") throw new Error("unreachable");
    expect(result.commits[0]).toMatchObject({
      sha: "a".repeat(40),
      date: "2026-11-02",
      repositoryId: "42",
      repositoryName: "acme/api",
      branch: "main",
    });
  });

  it("assigns the date from the commit timestamp in the user's timezone", () => {
    // 23:30 in New York on Nov 2 is 04:30 UTC on Nov 3.
    const late = payload({ commits: [commit({ timestamp: "2026-11-02T23:30:00-05:00" })] });
    const ny = extractCommits(late, { ...options, timeZone: "America/New_York" });
    const utc = extractCommits(late, options);
    expect(ny.kind === "commits" && ny.commits[0].date).toBe("2026-11-02");
    expect(utc.kind === "commits" && utc.commits[0].date).toBe("2026-11-03");
  });

  it("skips other authors only when onlyOwnCommits is on", () => {
    const mixed = payload({
      commits: [commit(), commit({ id: "b".repeat(40), author: { username: "someone", email: "s@e.com" } })],
    });
    const own = extractCommits(mixed, options);
    const all = extractCommits(mixed, { ...options, onlyOwnCommits: false });
    expect(own.kind === "commits" && [own.commits.length, own.skippedOtherAuthors]).toEqual([1, 1]);
    expect(all.kind === "commits" && all.commits.length).toBe(2);
  });

  it("de-duplicates SHAs within one payload", () => {
    const dup = payload({ commits: [commit(), commit()] });
    const result = extractCommits(dup, options);
    expect(result.kind === "commits" && result.commits.length).toBe(1);
  });

  it("handles empty commit lists", () => {
    const result = extractCommits(payload({ commits: [] }), options);
    expect(result).toEqual({ kind: "commits", commits: [], skippedOtherAuthors: 0 });
  });

  it("ignores deleted branches and tag pushes", () => {
    expect(extractCommits(payload({ deleted: true, commits: [] }), options).kind).toBe("ignored");
    expect(extractCommits(payload({ ref: "refs/tags/v1.0.0" }), options).kind).toBe("ignored");
  });
});
