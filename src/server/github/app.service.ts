import "server-only";
import { z } from "zod";
import { db } from "../db";
import { BadRequestError, NotFoundError } from "../errors";
import { importCommits } from "../journal.service";
import {
  exchangeUserCode,
  github,
  githubPaginate,
  installationToken,
  requireApp,
  GitHubApiError,
  type ApiCommit,
  type ApiInstallation,
  type ApiRepository,
} from "./app";
import { ensureGitHubLogin, loadIdentity } from "./github.service";
import { extractCommits, pushPayloadSchema, type PushCommit } from "./push";

/**
 * GitHub App integration: one App, one webhook for every user.
 *
 * Linking flow (/api/github/app/callback):
 *   GitHub redirects back with an OAuth `code` (the App has "Request user
 *   authorization during installation" on). We exchange it for a user token,
 *   confirm it's the same GitHub account the DevMemo user signed in with, and
 *   link exactly the installations GitHub says that user can access. The
 *   `installation_id` query param is never trusted on its own.
 */

export const BACKFILL_DAYS = 90;
const BACKFILL_MAX_PAGES = 10; // 100 commits per page → at most 1000 per repo
const MAX_REPOS_PER_INSTALLATION = 500;

export type InstallationView = {
  id: string;
  installationId: string;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
  suspended: boolean;
  configureUrl: string;
  repositories: {
    id: string;
    fullName: string;
    private: boolean;
    backfillStatus: string;
    backfillMessage: string | null;
  }[];
};

export function installUrl(): string {
  const app = requireApp();
  return `${app.webUrl}/apps/${app.slug}/installations/new`;
}

function configureUrl(installationId: string, accountType: string, accountLogin: string): string {
  const { webUrl } = requireApp();
  return accountType === "Organization"
    ? `${webUrl}/organizations/${accountLogin}/settings/installations/${installationId}`
    : `${webUrl}/settings/installations/${installationId}`;
}

export async function listInstallations(userId: string): Promise<InstallationView[]> {
  const rows = await db.gitHubInstallation.findMany({
    where: { userId },
    include: { repositories: { orderBy: { fullName: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    installationId: row.installationId,
    accountLogin: row.accountLogin,
    accountType: row.accountType,
    repositorySelection: row.repositorySelection,
    suspended: Boolean(row.suspendedAt),
    configureUrl: configureUrl(row.installationId, row.accountType, row.accountLogin),
    repositories: row.repositories.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      private: r.private,
      backfillStatus: r.backfillStatus,
      backfillMessage: r.backfillMessage,
    })),
  }));
}

/**
 * Links every installation the user can access. Returns the ids of
 * repositories that need a history import.
 */
export async function linkInstallationsFromCode(userId: string, code: string): Promise<string[]> {
  const account = await db.account.findFirst({
    where: { userId, providerId: "github" },
    select: { accountId: true },
  });
  if (!account) throw new BadRequestError("Sign in with GitHub first");

  const userToken = await exchangeUserCode(code);
  const ghUser = await github<{ id: number; login: string }>("/user", { token: userToken });
  if (String(ghUser.id) !== account.accountId) {
    throw new BadRequestError(
      `You authorized GitHub as @${ghUser.login}, but you're signed in to DevMemo with a different GitHub account.`,
    );
  }
  await db.user.update({ where: { id: userId }, data: { githubLogin: ghUser.login } });

  const { items: installations } = await githubPaginate<ApiInstallation, { installations: ApiInstallation[] }>(
    "/user/installations?per_page=100",
    { token: userToken, pick: (page) => page.installations, maxPages: 5 },
  );

  const toBackfill: string[] = [];
  for (const inst of installations) {
    if (!inst.account) continue;
    const row = await db.gitHubInstallation.upsert({
      where: { userId_installationId: { userId, installationId: String(inst.id) } },
      create: {
        userId,
        installationId: String(inst.id),
        accountLogin: inst.account.login,
        accountType: inst.account.type,
        repositorySelection: inst.repository_selection,
        suspendedAt: inst.suspended_at ? new Date(inst.suspended_at) : null,
      },
      update: {
        accountLogin: inst.account.login,
        accountType: inst.account.type,
        repositorySelection: inst.repository_selection,
        suspendedAt: inst.suspended_at ? new Date(inst.suspended_at) : null,
      },
    });
    toBackfill.push(...(await syncRepositories(row.id)));
  }
  await ensureGitHubLogin(userId);
  return toBackfill;
}

/**
 * Mirrors the installation's repository list. New repositories are marked
 * pending (to import history); removed ones are deleted. Returns new ids.
 */
export async function syncRepositories(installationRef: string): Promise<string[]> {
  const row = await db.gitHubInstallation.findUniqueOrThrow({ where: { id: installationRef } });
  const token = await installationToken(row.installationId);
  const { items: repos } = await githubPaginate<ApiRepository, { repositories: ApiRepository[] }>(
    "/installation/repositories?per_page=100",
    { token, pick: (page) => page.repositories, maxPages: Math.ceil(MAX_REPOS_PER_INSTALLATION / 100) },
  );

  const existing = await db.gitHubRepository.findMany({
    where: { installationRef },
    select: { id: true, repoId: true },
  });
  const known = new Map(existing.map((r) => [r.repoId, r.id]));
  const seen = new Set<string>();
  const created: string[] = [];

  for (const repo of repos) {
    const repoId = String(repo.id);
    seen.add(repoId);
    if (known.has(repoId)) {
      await db.gitHubRepository.update({
        where: { id: known.get(repoId)! },
        data: { fullName: repo.full_name, private: repo.private, defaultBranch: repo.default_branch ?? null },
      });
    } else {
      const createdRow = await db.gitHubRepository.create({
        data: {
          installationRef,
          repoId,
          fullName: repo.full_name,
          private: repo.private,
          defaultBranch: repo.default_branch ?? null,
        },
        select: { id: true },
      });
      created.push(createdRow.id);
    }
  }

  const removed = existing.filter((r) => !seen.has(r.repoId)).map((r) => r.id);
  if (removed.length) await db.gitHubRepository.deleteMany({ where: { id: { in: removed } } });
  return created;
}

/** Removes the link in DevMemo. Uninstalling the App itself happens on GitHub. */
export async function unlinkInstallation(userId: string, id: string): Promise<void> {
  const { count } = await db.gitHubInstallation.deleteMany({ where: { id, userId } });
  if (count === 0) throw new NotFoundError("Installation not found");
}

export async function requestReimport(userId: string): Promise<string[]> {
  const repos = await db.gitHubRepository.findMany({
    where: { installation: { userId, suspendedAt: null } },
    select: { id: true },
  });
  const ids = repos.map((r) => r.id);
  await db.gitHubRepository.updateMany({
    where: { id: { in: ids } },
    data: { backfillStatus: "pending", backfillMessage: null },
  });
  return ids;
}

function toPushCommit(c: ApiCommit): PushCommit {
  return {
    id: c.sha,
    message: c.commit.message,
    timestamp: c.commit.author?.date ?? new Date().toISOString(),
    url: c.html_url,
    author: {
      name: c.commit.author?.name ?? null,
      email: c.commit.author?.email ?? null,
      username: c.author?.login ?? null,
    },
    committer: null,
  };
}

/**
 * Imports the last BACKFILL_DAYS of commits for the given repositories.
 * Safe to re-run: commits are de-duplicated by SHA. Errors are recorded per
 * repository and never thrown, so one failing repo doesn't stop the rest.
 */
export async function backfillRepositories(repoIds: string[]): Promise<void> {
  const since = new Date(Date.now() - BACKFILL_DAYS * 86_400_000).toISOString();

  for (const id of repoIds) {
    const repo = await db.gitHubRepository.findUnique({
      where: { id },
      include: { installation: { select: { userId: true, installationId: true, suspendedAt: true } } },
    });
    if (!repo || repo.installation.suspendedAt) continue;

    await db.gitHubRepository.update({
      where: { id },
      data: { backfillStatus: "running", backfillMessage: null },
    });

    try {
      const { identity, timeZone, onlyOwnCommits } = await loadIdentity(repo.installation.userId);
      const token = await installationToken(repo.installation.installationId);
      const params = new URLSearchParams({ since, per_page: "100" });
      // Narrow on GitHub's side when we know the username; isOwnCommit still filters precisely.
      if (onlyOwnCommits && identity.githubLogin) params.set("author", identity.githubLogin);

      const { items, truncated } = await githubPaginate<ApiCommit>(
        `/repos/${repo.fullName}/commits?${params}`,
        { token, maxPages: BACKFILL_MAX_PAGES },
      );

      const extracted = extractCommits(
        {
          ref: `refs/heads/${repo.defaultBranch ?? "main"}`,
          repository: { id: repo.repoId, full_name: repo.fullName },
          commits: items.map(toPushCommit),
        },
        { timeZone, identity, onlyOwnCommits },
      );
      const found = extracted.kind === "commits" ? extracted.commits : [];
      const { imported } = await importCommits(repo.installation.userId, found);
      const plural = (n: number) => `${n} commit${n === 1 ? "" : "s"}`;
      const summary =
        found.length === 0
          ? `No commits of yours in the last ${BACKFILL_DAYS} days`
          : imported === found.length
            ? `${plural(imported)} imported from the last ${BACKFILL_DAYS} days`
            : `${plural(found.length)} from the last ${BACKFILL_DAYS} days, ${imported} new`;

      await db.gitHubRepository.update({
        where: { id },
        data: {
          backfillStatus: "done",
          backfilledAt: new Date(),
          backfillMessage: `${summary}${truncated ? " (limit reached)" : ""}`,
        },
      });
    } catch (error) {
      // An empty repository answers 409 on the commits endpoint.
      const empty = error instanceof GitHubApiError && error.status === 409;
      if (!empty) console.error("[github-app] backfill failed", { repo: repo.fullName, error });
      await db.gitHubRepository.update({
        where: { id },
        data: empty
          ? { backfillStatus: "done", backfilledAt: new Date(), backfillMessage: "Repository is empty" }
          : {
              backfillStatus: "error",
              backfillMessage: error instanceof Error ? error.message.slice(0, 300) : "Import failed",
            },
      });
    }
  }
}

const installationRefSchema = z.object({ installation: z.object({ id: z.union([z.number(), z.string()]) }) });

const installationEventSchema = z.object({
  action: z.string(),
  installation: z.object({
    id: z.union([z.number(), z.string()]),
    repository_selection: z.enum(["all", "selected"]).optional(),
  }),
});

const repositoriesEventSchema = z.object({
  action: z.enum(["added", "removed"]),
  installation: z.object({ id: z.union([z.number(), z.string()]) }),
  repository_selection: z.enum(["all", "selected"]).optional(),
});

export type AppEventResult = { status: number; message: string; backfill?: string[] };

export async function handleAppEvent(event: string | null, payload: unknown): Promise<AppEventResult> {
  if (event === "ping") return { status: 200, message: "pong" };

  if (event === "push") {
    const ref = installationRefSchema.safeParse(payload);
    const push = pushPayloadSchema.safeParse(payload);
    if (!ref.success || !push.success) return { status: 400, message: "Invalid push payload" };

    const links = await db.gitHubInstallation.findMany({
      where: { installationId: String(ref.data.installation.id), suspendedAt: null },
      select: { userId: true },
    });
    let imported = 0;
    for (const { userId } of links) {
      const { identity, timeZone, onlyOwnCommits } = await loadIdentity(userId);
      const extracted = extractCommits(push.data, { timeZone, identity, onlyOwnCommits });
      if (extracted.kind === "commits") imported += (await importCommits(userId, extracted.commits)).imported;
    }
    return { status: 200, message: `${imported} commit(s) imported for ${links.length} linked user(s)` };
  }

  if (event === "installation") {
    const parsed = installationEventSchema.safeParse(payload);
    if (!parsed.success) return { status: 400, message: "Invalid installation payload" };
    const installationId = String(parsed.data.installation.id);
    switch (parsed.data.action) {
      case "deleted":
        await db.gitHubInstallation.deleteMany({ where: { installationId } });
        return { status: 200, message: "Installation removed" };
      case "suspend":
        await db.gitHubInstallation.updateMany({ where: { installationId }, data: { suspendedAt: new Date() } });
        return { status: 200, message: "Installation suspended" };
      case "unsuspend":
        await db.gitHubInstallation.updateMany({ where: { installationId }, data: { suspendedAt: null } });
        return { status: 200, message: "Installation resumed" };
      default:
        // "created" is linked through the user-authorized callback, never from here.
        return { status: 202, message: `installation.${parsed.data.action} ignored` };
    }
  }

  if (event === "installation_repositories") {
    const parsed = repositoriesEventSchema.safeParse(payload);
    if (!parsed.success) return { status: 400, message: "Invalid installation_repositories payload" };
    const rows = await db.gitHubInstallation.findMany({
      where: { installationId: String(parsed.data.installation.id) },
      select: { id: true },
    });
    const backfill: string[] = [];
    for (const row of rows) {
      if (parsed.data.repository_selection) {
        await db.gitHubInstallation.update({
          where: { id: row.id },
          data: { repositorySelection: parsed.data.repository_selection },
        });
      }
      backfill.push(...(await syncRepositories(row.id)));
    }
    return { status: 200, message: `Repositories synced for ${rows.length} link(s)`, backfill };
  }

  return { status: 202, message: `Event "${event ?? "unknown"}" ignored` };
}
