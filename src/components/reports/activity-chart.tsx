import type { ReportView } from "@/server/reports.service";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Paired bars per day: commits and notes. Thin marks anchored to the
 * baseline, rounded data ends, per-day hover tooltip, legend, and an
 * accessible table alternative (the day list below the chart).
 */
export function ActivityChart({ daily, mode }: { daily: ReportView["daily"]; mode: "week" | "month" }) {
  const max = Math.max(1, ...daily.map((d) => Math.max(d.commits, d.notes)));
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];

  return (
    <figure>
      <div className="mb-5 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-commits" /> Commits
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-notes" /> Notes
        </span>
      </div>
      <div className="flex gap-2">
        <div className="relative h-40 w-6 shrink-0 text-right text-[10px] text-muted tabular-nums" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0" aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-border/70" style={{ bottom: `${(t / max) * 100}%` }} />
            ))}
          </div>
          <ol className="relative flex h-40 items-end" aria-label="Daily activity">
            {daily.map((d) => (
              <li key={d.date} className="group relative flex h-full flex-1 items-end justify-center gap-0.5 px-px">
                <span
                  className="w-full max-w-2.5 rounded-t-[4px] bg-chart-commits transition-opacity group-hover:opacity-80"
                  style={{ height: `${(d.commits / max) * 100}%` }}
                />
                <span
                  className="w-full max-w-2.5 rounded-t-[4px] bg-chart-notes transition-opacity group-hover:opacity-80"
                  style={{ height: `${(d.notes / max) * 100}%` }}
                />
                {/* hover tooltip; hit target is the whole day column */}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg group-hover:block"
                >
                  <b className="block">{LONG.format(new Date(`${d.date}T00:00:00Z`))}</b>
                  {d.commits} commit{d.commits === 1 ? "" : "s"} · {d.notes} note{d.notes === 1 ? "" : "s"}
                  {d.isWorkDay ? " · workday" : ""}
                </span>
                <span className="sr-only">
                  {d.date}: {d.commits} commits, {d.notes} notes
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="ml-8 flex text-[10px] text-muted" aria-hidden>
        {daily.map((d, i) => {
          const date = new Date(`${d.date}T00:00:00Z`);
          const show = mode === "week" || i === 0 || date.getUTCDate() % 5 === 0;
          return (
            <span key={d.date} className={`flex-1 text-center ${d.isWorkDay ? "font-semibold text-foreground" : ""}`}>
              {show ? (mode === "week" ? WEEKDAY.format(date) : date.getUTCDate()) : ""}
            </span>
          );
        })}
      </div>
    </figure>
  );
}
