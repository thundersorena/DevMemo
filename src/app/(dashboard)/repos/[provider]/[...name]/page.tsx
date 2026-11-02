import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { ExternalIcon } from "@/components/ui/icons";
import { getRepositoryTimeline } from "@/server/repos.service";
import { requireUser } from "@/server/session";
import { formatLongDate, formatTime, isValidDateKey } from "@/lib/dates";

const PROVIDERS = new Set(["github", "gitlab", "bitbucket"]);

export async function generateMetadata({ params }: PageProps<"/repos/[provider]/[...name]">): Promise<Metadata> {
  const { name } = await params;
  return { title: name.map(decodeURIComponent).join("/") };
}

export default function RepoTimelinePage({ params, searchParams }: PageProps<"/repos/[provider]/[...name]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-border bg-surface" />}>
        <Timeline params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Timeline({
  params,
  searchParams,
}: Pick<PageProps<"/repos/[provider]/[...name]">, "params" | "searchParams">) {
  const { provider, name: segments } = await params;
  if (!PROVIDERS.has(provider)) notFound();
  const name = segments.map(decodeURIComponent).join("/");
  const { before } = await searchParams;
  const user = await requireUser();

  const timeline = await getRepositoryTimeline(
    user.id,
    provider,
    name,
    typeof before === "string" && isValidDateKey(before) ? before : undefined,
  );
  if (!timeline) notFound();

  return (
    <>
      <Link href="/repos" className="text-sm text-muted transition hover:text-foreground">
        ← Repositories
      </Link>
      <header className="mt-3 mb-8">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="mt-1 text-sm text-muted">
          {timeline.totalCommits} commit{timeline.totalCommits === 1 ? "" : "s"} · {provider}
          {" · "}
          <Link href={`/search?q=${encodeURIComponent(name.split("/").at(-1) ?? name)}&repository=${encodeURIComponent(name)}`} className="underline underline-offset-2 hover:text-foreground">
            search in this repository
          </Link>
        </p>
      </header>

      <ol className="relative space-y-8 border-l border-border pl-6">
        {timeline.days.map((day) => (
          <li key={day.date} className="relative">
            <span aria-hidden className="absolute top-1.5 -left-[29px] size-2.5 rounded-full border-2 border-background bg-chart-commits" />
            <h2 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
              <Link href={`/journal/${day.date}`} className="hover:underline">
                {formatLongDate(day.date)}
              </Link>
              {day.isWorkDay && <span className="rounded bg-workday/12 px-1.5 py-0.5 text-[10px] font-medium text-workday">work</span>}
            </h2>

            {(day.summary || day.notes.length > 0) && (
              <div className="mb-3 space-y-1 border-l-2 border-chart-notes/40 pl-3 text-sm text-muted">
                {day.summary ? (
                  <p>{day.summary}</p>
                ) : (
                  day.notes.slice(0, 4).map((n) => <p key={n.id} className="line-clamp-2">{n.content}</p>)
                )}
              </div>
            )}

            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
              {day.commits.map((c) => (
                <li key={c.id}>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-3 px-3 py-2 text-sm transition hover:bg-surface-muted"
                  >
                    <code className="mt-0.5 shrink-0 rounded bg-git/10 px-1.5 py-0.5 font-mono text-xs text-git">{c.sha.slice(0, 7)}</code>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.message.split("\n")[0]}</span>
                      <span className="text-xs text-muted">
                        {formatTime(new Date(c.committedAt), user.timezone)}
                        {c.branch ? ` · ${c.branch}` : ""}
                      </span>
                    </span>
                    <ExternalIcon className="mt-1 size-3.5 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {timeline.nextBefore && (
        <div className="mt-8 text-center">
          <Link href={`?before=${timeline.nextBefore}`} className={buttonClass("secondary")}>
            Older activity
          </Link>
        </div>
      )}
    </>
  );
}
