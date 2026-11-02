import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommitList } from "@/components/journal/commit-list";
import { NoteComposer } from "@/components/journal/note-composer";
import { NoteItem } from "@/components/journal/note-item";
import { WorkdayToggle } from "@/components/journal/workday-toggle";
import { buttonClass } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, GitCommitIcon } from "@/components/ui/icons";
import { getDay } from "@/server/journal.service";
import { requireUser } from "@/server/session";
import {
  addDays,
  formatLongDate,
  formatMonthParam,
  formatTime,
  isValidDateKey,
  monthOf,
  todayKey,
} from "@/lib/dates";

export async function generateMetadata({ params }: PageProps<"/journal/[date]">): Promise<Metadata> {
  const { date } = await params;
  return { title: isValidDateKey(date) ? formatLongDate(date) : "Journal" };
}

export default function JournalPage({ params }: PageProps<"/journal/[date]">) {
  return (
    <Suspense fallback={<JournalSkeleton />}>
      <JournalContent params={params} />
    </Suspense>
  );
}

async function JournalContent({ params }: Pick<PageProps<"/journal/[date]">, "params">) {
  const { date } = await params;
  if (!isValidDateKey(date)) notFound();

  const user = await requireUser();
  const day = await getDay(user.id, date);
  const today = todayKey(user.timezone);
  const relative =
    date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : date === addDays(today, 1) ? "Tomorrow" : null;

  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            href={`/calendar?month=${formatMonthParam(monthOf(date))}`}
            className="text-sm text-muted transition hover:text-foreground"
          >
            ← Calendar
          </Link>
          <nav className="flex items-center gap-1.5" aria-label="Day navigation">
            <Link href={`/journal/${addDays(date, -1)}`} className={buttonClass("secondary", "", "icon")} aria-label="Previous day">
              <ChevronLeft />
            </Link>
            {date !== today && (
              <Link href={`/journal/${today}`} className={buttonClass("secondary")}>
                Today
              </Link>
            )}
            <Link href={`/journal/${addDays(date, 1)}`} className={buttonClass("secondary", "", "icon")} aria-label="Next day">
              <ChevronRight />
            </Link>
          </nav>
        </div>
        {relative && <p className="text-sm font-medium text-accent">{relative}</p>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{formatLongDate(date)}</h1>
        <div className="mt-4">
          <WorkdayToggle key={`${date}-${day.isWorkDay}`} date={date} isWorkDay={day.isWorkDay} />
        </div>
      </header>

      <section aria-labelledby="notes-heading" className="mb-10">
        <SectionHeading id="notes-heading" title="Daily notes" count={day.notes.length} />
        {day.notes.length > 0 && (
          <ol className="mb-5 space-y-5 border-l border-border pl-0 [&>li]:-ml-[5px]">
            {day.notes.map((note) => (
              <NoteItem
                key={note.id}
                date={date}
                note={note}
                time={formatTime(new Date(note.createdAt), user.timezone)}
              />
            ))}
          </ol>
        )}
        <NoteComposer date={date} />
      </section>

      <section aria-labelledby="git-heading" className="mb-10">
        <SectionHeading id="git-heading" title="Git activity" count={day.commits.length} />
        {day.commits.length > 0 ? (
          <CommitList commits={day.commits} timeZone={user.timezone} />
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted">
            <GitCommitIcon className="size-5 shrink-0" />
            <span>
              No commits on this day.{" "}
              <Link href="/settings#github" className="underline underline-offset-2 hover:text-foreground">
                Connect GitHub
              </Link>{" "}
              to import activity automatically.
            </span>
          </div>
        )}
      </section>

      {day.summary && (
        <section aria-labelledby="summary-heading">
          <SectionHeading id="summary-heading" title="AI summary" />
          <div className="rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap">
            {day.summary}
          </div>
        </section>
      )}
    </article>
  );
}

function SectionHeading({ id, title, count }: { id: string; title: string; count?: number }) {
  return (
    <h2 id={id} className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
      {title}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium normal-case tracking-normal">
          {count}
        </span>
      )}
    </h2>
  );
}

function JournalSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="h-6 w-24 animate-pulse rounded bg-surface-muted" />
      <div className="h-9 w-80 animate-pulse rounded-lg bg-surface-muted" />
      <div className="h-9 w-28 animate-pulse rounded-lg bg-surface-muted" />
      <div className="h-32 animate-pulse rounded-xl border border-border bg-surface" />
      <div className="h-24 animate-pulse rounded-xl border border-border bg-surface" />
    </div>
  );
}
