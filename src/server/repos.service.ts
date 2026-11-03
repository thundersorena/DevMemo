import "server-only";
import { dbToDateKey, type DateKey } from "@/lib/dates";
import { db } from "./db";
import { getRange, type CommitView, type NoteView } from "./journal.service";

export type RepositorySummary = {
  provider: string;
  name: string;
  commits: number;
  firstDate: DateKey;
  lastDate: DateKey;
};

export async function listRepositories(userId: string): Promise<RepositorySummary[]> {
  const groups = await db.commit.groupBy({
    by: ["provider", "repositoryName"],
    where: { userId },
    _count: { _all: true },
    _min: { committedAt: true },
    _max: { committedAt: true },
  });
  return groups
    .map((g) => ({
      provider: g.provider,
      name: g.repositoryName,
      commits: g._count._all,
      firstDate: dbToDateKey(g._min.committedAt!),
      lastDate: dbToDateKey(g._max.committedAt!),
    }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.commits - a.commits);
}

export type TimelineDay = {
  date: DateKey;
  isWorkDay: boolean;
  summary: string | null;
  commits: CommitView[];
  notes: NoteView[];
};

export type RepositoryTimeline = {
  provider: string;
  name: string;
  totalCommits: number;
  days: TimelineDay[];
  /** Date to pass as `before` to load older days, or null when complete. */
  nextBefore: DateKey | null;
};

const DAYS_PER_PAGE = 30;

export async function getRepositoryTimeline(
  userId: string,
  provider: string,
  name: string,
  before?: DateKey,
): Promise<RepositoryTimeline | null> {
  const where = { userId, provider, repositoryName: name };
  const totalCommits = await db.commit.count({ where });
  if (totalCommits === 0) return null;

  const dayRows = await db.day.findMany({
    where: {
      userId,
      commits: { some: { provider, repositoryName: name } },
      ...(before ? { date: { lt: new Date(`${before}T00:00:00.000Z`) } } : {}),
    },
    select: { date: true },
    orderBy: { date: "desc" },
    take: DAYS_PER_PAGE + 1,
  });
  const hasMore = dayRows.length > DAYS_PER_PAGE;
  const dates = dayRows.slice(0, DAYS_PER_PAGE).map((d) => dbToDateKey(d.date));
  if (dates.length === 0) return { provider, name, totalCommits, days: [], nextBefore: null };

  const range = await getRange(userId, dates.at(-1)!, dates[0]);
  const wanted = new Set(dates);
  const days: TimelineDay[] = range
    .filter((d) => wanted.has(d.date))
    .map((d) => ({
      date: d.date,
      isWorkDay: d.isWorkDay,
      summary: d.summary,
      commits: d.commits.filter((c) => c.provider === provider && c.repositoryName === name),
      notes: d.notes,
    }))
    .reverse();

  return { provider, name, totalCommits, days, nextBefore: hasMore ? dates.at(-1)! : null };
}
