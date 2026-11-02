import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractCommits, type AuthorIdentity } from "../github/push";
import {
  parseBitbucketPush,
  parseGitLabPush,
  parseRawAuthor,
  verifyBitbucketSignature,
  verifyGitLabToken,
} from "./providers";

const me: AuthorIdentity = { githubLogin: "pouya", githubId: "1", emails: ["pouya@work.dev"] };
const sha = (c: string) => c.repeat(40);

describe("GitLab", () => {
  const push = {
    object_kind: "push",
    ref: "refs/heads/main",
    before: sha("0"),
    after: sha("b"),
    project: { id: 42, path_with_namespace: "team/api" },
    commits: [
      { id: sha("a"), message: "Mine", timestamp: "2026-11-02T22:30:00+00:00", url: "https://gitlab.com/c/a", author: { name: "P", email: "pouya@work.dev" } },
      { id: sha("b"), message: "Theirs", timestamp: "2026-11-02T10:00:00+00:00", url: "https://gitlab.com/c/b", author: { name: "X", email: "x@work.dev" } },
    ],
  };

  it("verifies the token in constant time", () => {
    expect(verifyGitLabToken("s3cret", "s3cret")).toBe(true);
    expect(verifyGitLabToken("s3cre", "s3cret")).toBe(false);
    expect(verifyGitLabToken(null, "s3cret")).toBe(false);
  });

  it("converts a push and matches authors by email", () => {
    const result = parseGitLabPush("Push Hook", push);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const extracted = extractCommits(result.pushes[0], { timeZone: "Asia/Tehran", identity: me, onlyOwnCommits: true });
    expect(extracted).toMatchObject({ kind: "commits", skippedOtherAuthors: 1 });
    if (extracted.kind !== "commits") return;
    expect(extracted.commits[0]).toMatchObject({
      repositoryId: "gitlab:42",
      repositoryName: "team/api",
      branch: "main",
      date: "2026-11-03", // 22:30 UTC is after midnight in Tehran
    });
  });

  it("treats a zero `after` SHA as a branch deletion", () => {
    const result = parseGitLabPush("Push Hook", { ...push, after: sha("0"), commits: [] });
    expect(result.ok && extractCommits(result.pushes[0], { timeZone: "UTC", identity: me, onlyOwnCommits: true }).kind).toBe("ignored");
  });

  it("ignores other events", () => {
    expect(parseGitLabPush("Merge Request Hook", push)).toMatchObject({ ok: false });
  });
});

describe("Bitbucket", () => {
  const body = {
    repository: { uuid: "{abc-123}", full_name: "team/web" },
    push: {
      changes: [
        {
          new: { type: "branch", name: "feature/x" },
          old: { type: "branch", name: "feature/x" },
          commits: [
            { hash: sha("c"), message: "Bitbucket work\n", date: "2026-11-02T08:00:00+00:00", author: { raw: "Pouya <pouya@work.dev>", user: { nickname: "pouya-bb" } }, links: { html: { href: "https://bitbucket.org/c/c" } } },
          ],
        },
        { new: null, old: { type: "branch", name: "old-branch" }, closed: true, commits: [] },
      ],
    },
  };

  it("verifies the HMAC signature", () => {
    const raw = JSON.stringify(body);
    const sig = `sha256=${createHmac("sha256", "k").update(raw).digest("hex")}`;
    expect(verifyBitbucketSignature(raw, sig, "k")).toBe(true);
    expect(verifyBitbucketSignature(raw, sig, "other")).toBe(false);
    expect(verifyBitbucketSignature(raw + " ", sig, "k")).toBe(false);
    expect(verifyBitbucketSignature(raw, null, "k")).toBe(false);
  });

  it("parses raw authors", () => {
    expect(parseRawAuthor("Jane Doe <jane@x.dev>")).toEqual({ name: "Jane Doe", email: "jane@x.dev" });
    expect(parseRawAuthor("jane")).toEqual({ name: "jane", email: null });
    expect(parseRawAuthor(null)).toEqual({ name: null, email: null });
  });

  it("converts each change; deleted branches are ignored", () => {
    const result = parseBitbucketPush("repo:push", body);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pushes).toHaveLength(2);
    const first = extractCommits(result.pushes[0], { timeZone: "UTC", identity: me, onlyOwnCommits: true });
    expect(first.kind === "commits" && first.commits[0]).toMatchObject({
      repositoryId: "bitbucket:{abc-123}",
      branch: "feature/x",
      message: "Bitbucket work\n",
    });
    expect(extractCommits(result.pushes[1], { timeZone: "UTC", identity: me, onlyOwnCommits: true }).kind).toBe("ignored");
  });
});
