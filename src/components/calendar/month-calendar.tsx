import Link from "next/link";
import type { MonthView } from "@/server/journal.service";
import {
  addMonths,
  formatMonthParam,
  formatMonthTitle,
  monthGrid,
  monthOf,
  type DateKey,
  type MonthKey,
} from "@/lib/dates";
import { buttonClass } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthCalendar({
  month,
  data,
  today,
}: {
  month: MonthKey;
  data: MonthView;
  today: DateKey;
}) {
  const byDate = new Map(data.days.map((d) => [d.date, d]));
  const grid = monthGrid(month);
  const todayMonth = monthOf(today);
  const isCurrentMonth = todayMonth.year === month.year && todayMonth.month === month.month;

  const workdays = data.days.filter((d) => d.isWorkDay).length;
  const activeDays = data.days.filter((d) => d.commitCount > 0).length;
  const commits = data.days.reduce((sum, d) => sum + d.commitCount, 0);

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{formatMonthTitle(month)}</h1>
          <p className="mt-1 text-sm text-muted">
            {workdays} workday{workdays === 1 ? "" : "s"} · {commits} commit
            {commits === 1 ? "" : "s"} across {activeDays} day{activeDays === 1 ? "" : "s"}
          </p>
        </div>
        <nav className="flex items-center gap-1.5" aria-label="Month navigation">
          <Link
            href={`/calendar?month=${formatMonthParam(addMonths(month, -1))}`}
            className={buttonClass("secondary", "", "icon")}
            aria-label="Previous month"
          >
            <ChevronLeft />
          </Link>
          {!isCurrentMonth && (
            <Link href="/calendar" className={buttonClass("secondary")}>
              Today
            </Link>
          )}
          <Link
            href={`/calendar?month=${formatMonthParam(addMonths(month, 1))}`}
            className={buttonClass("secondary", "", "icon")}
            aria-label="Next month"
          >
            <ChevronRight />
          </Link>
        </nav>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="grid grid-cols-7 border-b border-border bg-surface-muted/60">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((date, i) => {
            const info = byDate.get(date);
            const inMonth = monthOf(date).month === month.month;
            const isToday = date === today;
            const dayNumber = Number(date.slice(8));
            return (
              <Link
                key={date}
                href={`/journal/${date}`}
                className={`group relative flex min-h-20 flex-col gap-1.5 p-2 transition hover:bg-surface-muted sm:min-h-24 ${
                  i % 7 !== 6 ? "border-r border-border" : ""
                } ${i < grid.length - 7 ? "border-b border-border" : ""} ${
                  inMonth ? "" : "bg-surface-muted/40 text-muted/60"
                }`}
                aria-label={`${date}${info?.isWorkDay ? ", workday" : ""}${
                  info?.commitCount ? `, ${info.commitCount} commits` : ""
                }`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-full text-sm tabular-nums ${
                    isToday ? "bg-foreground font-semibold text-background" : ""
                  }`}
                >
                  {dayNumber}
                </span>
                {info && (
                  <div className="mt-auto flex flex-wrap items-center gap-1">
                    {info.isWorkDay && (
                      <span className="rounded bg-workday/12 px-1.5 py-0.5 text-[10px] font-medium text-workday">
                        work
                      </span>
                    )}
                    {info.commitCount > 0 && (
                      <span className="rounded bg-git/12 px-1.5 py-0.5 font-mono text-[10px] font-medium text-git">
                        {info.commitCount}c
                      </span>
                    )}
                    {info.noteCount > 0 && (
                      <span
                        className="size-1.5 rounded-full bg-muted"
                        title={`${info.noteCount} note${info.noteCount === 1 ? "" : "s"}`}
                      />
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="rounded bg-workday/12 px-1.5 py-0.5 text-[10px] font-medium text-workday">work</span>
          Marked as workday
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded bg-git/12 px-1.5 py-0.5 font-mono text-[10px] font-medium text-git">3c</span>
          Git commits
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-muted" />
          Has notes
        </span>
      </div>
    </section>
  );
}

export function MonthCalendarSkeleton() {
  return (
    <div>
      <div className="mb-6 h-12 w-56 animate-pulse rounded-lg bg-surface-muted" />
      <div className="h-[520px] animate-pulse rounded-xl border border-border bg-surface" />
    </div>
  );
}
