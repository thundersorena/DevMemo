import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityChart } from "@/components/reports/activity-chart";
import { CopyMarkdownButton } from "@/components/reports/copy-markdown";
import { buttonClass } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { daysToMarkdown } from "@/server/journal-format";
import { getReport } from "@/server/reports.service";
import { requireUser } from "@/server/session";
import {
  addDays,
  addMonths,
  formatLongDate,
  formatMonthParam,
  formatMonthTitle,
  isValidDateKey,
  monthOf,
  monthRange,
  todayKey,
  weekRange,
  type DateKey,
} from "@/lib/dates";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-xl border border-border bg-surface" />}>
      <Report searchParams={searchParams} />
    </Suspense>
  );
}

const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const short = (k: DateKey) => SHORT.format(new Date(`${k}T00:00:00Z`));

async function Report({ searchParams }: Pick<PageProps<"/reports">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const mode = params.period === "month" ? "month" : "week";
  const today = todayKey(user.timezone);
  const anchor = typeof params.date === "string" && isValidDateKey(params.date) ? params.date : today;

  const { start, end } = mode === "week" ? weekRange(anchor) : monthRange(monthOf(anchor));
  const prev = mode === "week" ? addDays(start, -7) : `${formatMonthParam(addMonths(monthOf(anchor), -1))}-01`;
  const next = mode === "week" ? addDays(start, 7) : `${formatMonthParam(addMonths(monthOf(anchor), 1))}-01`;
  const isCurrent = start <= today && today <= end;
  const title = mode === "week" ? `${short(start)} – ${short(end)}` : formatMonthTitle(monthOf(anchor));

  const report = await getReport(user.id, start, end);
  const markdown = daysToMarkdown(report.days, user.timezone, `DevMemo report: ${title}`);
  const maxRepo = Math.max(1, ...report.repositories.map((r) => r.commits));
  const href = (period: string, date: DateKey) => `/reports?period=${period}&date=${date}`;

  const stats = [
    ["Active days", report.totals.activeDays],
    ["Workdays", report.totals.workdays],
    ["Commits", report.totals.commits],
    ["Notes", report.totals.notes],
    ["Repositories", report.totals.repositories],
  ] as const;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm" role="tablist">
            {(["week", "month"] as const).map((p) => (
              <Link
                key={p}
                role="tab"
                aria-selected={mode === p}
                href={href(p, anchor)}
                className={`rounded-md px-3 py-1 capitalize ${mode === p ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
              >
                {p}
              </Link>
            ))}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatLongDate(start)} – {formatLongDate(end)}
          </p>
        </div>
        <nav className="flex items-center gap-1.5" aria-label="Period navigation">
          <Link href={href(mode, prev)} className={buttonClass("secondary", "", "icon")} aria-label="Previous period">
            <ChevronLeft />
          </Link>
          {!isCurrent && (
            <Link href={`/reports?period=${mode}`} className={buttonClass("secondary")}>
              Current
            </Link>
          )}
          <Link href={href(mode, next)} className={buttonClass("secondary", "", "icon")} aria-label="Next period">
            <ChevronRight />
          </Link>
        </nav>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5 [&>*]:min-w-0">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">Daily activity</h2>
        <ActivityChart daily={report.daily} mode={mode} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr] [&>*]:min-w-0">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">Repositories</h2>
          {report.repositories.length === 0 ? (
            <p className="text-sm text-muted">No commits in this period.</p>
          ) : (
            <ul className="space-y-3">
              {report.repositories.map((r) => (
                <li key={`${r.provider}:${r.name}`}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <Link
                      href={`/repos/${r.provider}/${r.name}`}
                      className="truncate font-mono text-[13px] hover:underline"
                    >
                      {r.name}
                      {r.provider !== "github" && <span className="ml-1.5 font-sans text-xs text-muted">{r.provider}</span>}
                    </Link>
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                      {r.commits} commit{r.commits === 1 ? "" : "s"} · {r.activeDays} day{r.activeDays === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-muted">
                    <div className="h-2 rounded-full bg-chart-commits" style={{ width: `${(r.commits / maxRepo) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Days</h2>
            <div className="flex gap-1.5">
              <CopyMarkdownButton markdown={markdown} />
              <a href={`/api/export?format=md&from=${start}&to=${end}`} className={buttonClass("ghost", "", "sm")}>
                Download
              </a>
            </div>
          </div>
          {report.days.length === 0 ? (
            <p className="text-sm text-muted">No journal activity in this period.</p>
          ) : (
            <ul className="divide-y divide-border">
              {report.days.map((d) => (
                <li key={d.date} className="py-3 first:pt-0 last:pb-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                    <Link href={`/journal/${d.date}`} className="font-medium hover:underline">
                      {formatLongDate(d.date)}
                    </Link>
                    {d.isWorkDay && <span className="rounded bg-workday/12 px-1.5 py-0.5 text-[10px] font-medium text-workday">work</span>}
                    {d.commits.length > 0 && (
                      <span className="rounded bg-git/12 px-1.5 py-0.5 font-mono text-[10px] font-medium text-git">{d.commits.length}c</span>
                    )}
                  </div>
                  {d.summary ? (
                    <p className="text-sm leading-relaxed text-muted">{d.summary}</p>
                  ) : (
                    <ul className="space-y-0.5 text-sm text-muted">
                      {d.notes.slice(0, 3).map((n) => (
                        <li key={n.id} className="truncate">• {n.content.split("\n")[0]}</li>
                      ))}
                      {d.notes.length > 3 && <li className="text-xs">+{d.notes.length - 3} more</li>}
                      {d.notes.length === 0 && d.commits.length > 0 && (
                        <li className="truncate">• {d.commits[0].message.split("\n")[0]}</li>
                      )}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted">
            Want a written report? Ask your AI assistant with the <code className="font-mono">weekly_report</code> MCP prompt.
          </p>
        </section>
      </div>
    </div>
  );
}
