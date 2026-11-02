import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GitCommitIcon } from "@/components/ui/icons";
import { listRepositories } from "@/server/repos.service";
import { requireUser } from "@/server/session";
import { formatLongDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Repositories" };

const PROVIDER_LABEL: Record<string, string> = { github: "GitHub", gitlab: "GitLab", bitbucket: "Bitbucket" };

export default function ReposPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Repositories</h1>
      <p className="mt-1 mb-6 text-sm text-muted">The development history of each project, with your notes as context.</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />}>
        <RepoList />
      </Suspense>
    </div>
  );
}

async function RepoList() {
  const user = await requireUser();
  const repos = await listRepositories(user.id);

  if (repos.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted">
        <GitCommitIcon className="size-5 shrink-0" />
        <span>
          No commits yet.{" "}
          <Link href="/settings#github" className="underline underline-offset-2 hover:text-foreground">
            Connect a Git provider
          </Link>{" "}
          to build repository timelines.
        </span>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {repos.map((r) => (
        <li key={`${r.provider}:${r.name}`}>
          <Link
            href={`/repos/${r.provider}/${r.name}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-surface-muted"
          >
            <span className="font-mono text-sm font-medium">{r.name}</span>
            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted">
              {PROVIDER_LABEL[r.provider] ?? r.provider}
            </span>
            <span className="ml-auto text-xs text-muted tabular-nums">
              {r.commits} commit{r.commits === 1 ? "" : "s"} · last {formatLongDate(r.lastDate)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
