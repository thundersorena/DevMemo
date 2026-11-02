import "server-only";
import { addDays, type DateKey } from "@/lib/dates";
import { getRange, type DayView } from "./journal.service";

export type RepoActivity = {
  provider: string;
  name: string;
  commits: number;
  activeDays: number;
};

export type ReportView = {
  start: DateKey;
  end: DateKey;
  totals: {
    activeDays: number;
    workdays: number;
    notes: number;
    aiNotes: number;
    commits: number;
    repositories: number;
  };
  /** One entry per calendar day in the period, including empty days. */
  daily: { date: DateKey; commits: number; notes: number; isWorkDay: boolean }[];
  repositories: RepoActivity[];
  days: DayView[];
};

/** Activity report for an inclusive date range (a week or a month). */
export async function getReport(userId: string, start: DateKey, end: DateKey): Promise<ReportView> {
  const days = await getRange(userId, start, end);
  const byDate = new Map(days.map((d) => [d.date, d]));

  const daily: ReportView["daily"] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const d = byDate.get(date);
    daily.push({ date, commits: d?.commits.length ?? 0, notes: d?.notes.length ?? 0, isWorkDay: d?.isWorkDay ?? false });
  }

  const repos = new Map<string, RepoActivity & { dates: Set<string> }>();
  for (const day of days) {
    for (const c of day.commits) {
      const key = `${c.provider}:${c.repositoryName}`;
      const entry = repos.get(key) ?? { provider: c.provider, name: c.repositoryName, commits: 0, activeDays: 0, dates: new Set() };
      entry.commits++;
      entry.dates.add(day.date);
      repos.set(key, entry);
    }
  }

  const repositories = [...repos.values()]
    .map(({ dates, ...r }) => ({ ...r, activeDays: dates.size }))
    .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));

  const notes = days.flatMap((d) => d.notes);
  return {
    start,
    end,
    totals: {
      activeDays: days.filter((d) => d.notes.length || d.commits.length).length,
      workdays: days.filter((d) => d.isWorkDay).length,
      notes: notes.length,
      aiNotes: notes.filter((n) => n.source === "MCP").length,
      commits: days.reduce((sum, d) => sum + d.commits.length, 0),
      repositories: repositories.length,
    },
    daily,
    repositories,
    days,
  };
}
