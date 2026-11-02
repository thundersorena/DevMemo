import "server-only";
import { NoteSource, Prisma } from "@/generated/prisma/client";
import { dateKeyToDb, dbToDateKey, monthRange, type DateKey, type MonthKey } from "@/lib/dates";
import type { CommitInput } from "./github/push";
import type { UpdateDayInput } from "@/lib/validation";
import { db } from "./db";
import { NotFoundError } from "./errors";

/**
 * Journal service: the single place that reads and writes journal data.
 * REST handlers, server actions, the GitHub ingester and MCP tools all go
 * through these functions. Every function is scoped by userId.
 */

// ─── View types (plain JSON-safe objects) ──────────────────────────────────

export type NoteView = {
  id: string;
  content: string;
  source: NoteSource;
  createdAt: string;
  updatedAt: string;
};

export type CommitView = {
  id: string;
  provider: string;
  sha: string;
  repositoryId: string;
  repositoryName: string;
  message: string;
  branch: string | null;
  url: string;
  authorName: string | null;
  committedAt: string;
};

export type DayView = {
  date: DateKey;
  isWorkDay: boolean;
  summary: string | null;
  notes: NoteView[];
  commits: CommitView[];
};

export type MonthDayView = {
  date: DateKey;
  isWorkDay: boolean;
  noteCount: number;
  commitCount: number;
  hasSummary: boolean;
};

export type MonthView = {
  year: number;
  month: number;
  days: MonthDayView[];
};

// ─── Mappers ───────────────────────────────────────────────────────────────

const noteSelect = {
  id: true,
  content: true,
  source: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NoteSelect;

const commitSelect = {
  id: true,
  provider: true,
  sha: true,
  repositoryId: true,
  repositoryName: true,
  message: true,
  branch: true,
  url: true,
  authorName: true,
  committedAt: true,
} satisfies Prisma.CommitSelect;

function toNoteView(note: Prisma.NoteGetPayload<{ select: typeof noteSelect }>): NoteView {
  return {
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

function toCommitView(commit: Prisma.CommitGetPayload<{ select: typeof commitSelect }>): CommitView {
  return { ...commit, committedAt: commit.committedAt.toISOString() };
}

function emptyDay(date: DateKey): DayView {
  return { date, isWorkDay: false, summary: null, notes: [], commits: [] };
}

// ─── Internal helpers ──────────────────────────────────────────────────────

type Tx = Prisma.TransactionClient;

/** Find or create the Day row for a user/date. Safe under concurrency. */
export async function ensureDay(userId: string, date: DateKey, tx: Tx = db) {
  return tx.day.upsert({
    where: { userId_date: { userId, date: dateKeyToDb(date) } },
    create: { userId, date: dateKeyToDb(date) },
    update: {},
    select: { id: true },
  });
}

// ─── Queries ───────────────────────────────────────────────────────────────

export async function getDay(userId: string, date: DateKey): Promise<DayView> {
  const day = await db.day.findUnique({
    where: { userId_date: { userId, date: dateKeyToDb(date) } },
    select: {
      isWorkDay: true,
      summary: true,
      notes: { select: noteSelect, orderBy: { createdAt: "asc" } },
      commits: { select: commitSelect, orderBy: { committedAt: "asc" } },
    },
  });
  if (!day) return emptyDay(date);

  return {
    date,
    isWorkDay: day.isWorkDay,
    summary: day.summary,
    notes: day.notes.map(toNoteView),
    commits: day.commits.map(toCommitView),
  };
}

/** Full days (notes + commits) for an inclusive date range. Only days with content. */
export async function getRange(userId: string, from: DateKey, to: DateKey): Promise<DayView[]> {
  const days = await db.day.findMany({
    where: { userId, date: { gte: dateKeyToDb(from), lte: dateKeyToDb(to) } },
    select: {
      date: true,
      isWorkDay: true,
      summary: true,
      notes: { select: noteSelect, orderBy: { createdAt: "asc" } },
      commits: { select: commitSelect, orderBy: { committedAt: "asc" } },
    },
    orderBy: { date: "asc" },
  });
  return days
    .map((day) => ({
      date: dbToDateKey(day.date),
      isWorkDay: day.isWorkDay,
      summary: day.summary,
      notes: day.notes.map(toNoteView),
      commits: day.commits.map(toCommitView),
    }))
    .filter((d) => d.isWorkDay || d.summary || d.notes.length > 0 || d.commits.length > 0);
}

/** Earliest journal date of the user, or null if the journal is empty. */
export async function getFirstDate(userId: string): Promise<DateKey | null> {
  const first = await db.day.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } });
  return first ? dbToDateKey(first.date) : null;
}

export async function getMonth(userId: string, month: MonthKey): Promise<MonthView> {
  const { start, end } = monthRange(month);
  const days = await db.day.findMany({
    where: { userId, date: { gte: dateKeyToDb(start), lte: dateKeyToDb(end) } },
    select: {
      date: true,
      isWorkDay: true,
      summary: true,
      _count: { select: { notes: true, commits: true } },
    },
    orderBy: { date: "asc" },
  });

  return {
    year: month.year,
    month: month.month,
    days: days
      .map((day) => ({
        date: dbToDateKey(day.date),
        isWorkDay: day.isWorkDay,
        noteCount: day._count.notes,
        commitCount: day._count.commits,
        hasSummary: Boolean(day.summary),
      }))
      // Hide days that exist but carry no information (e.g. a note was deleted).
      .filter((d) => d.isWorkDay || d.noteCount > 0 || d.commitCount > 0 || d.hasSummary),
  };
}

export async function getCommits(
  userId: string,
  date: DateKey,
  repository?: string,
): Promise<CommitView[]> {
  const commits = await db.commit.findMany({
    where: {
      userId,
      day: { date: dateKeyToDb(date) },
      ...(repository
        ? { repositoryName: { contains: repository, mode: "insensitive" } }
        : {}),
    },
    select: commitSelect,
    orderBy: { committedAt: "asc" },
  });
  return commits.map(toCommitView);
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export async function updateDay(
  userId: string,
  date: DateKey,
  input: UpdateDayInput,
): Promise<DayView> {
  const data: Prisma.DayUpdateInput = {};
  if (input.isWorkDay !== undefined) data.isWorkDay = input.isWorkDay;
  if (input.summary !== undefined) data.summary = input.summary || null;

  await db.day.upsert({
    where: { userId_date: { userId, date: dateKeyToDb(date) } },
    create: {
      userId,
      date: dateKeyToDb(date),
      isWorkDay: input.isWorkDay ?? false,
      summary: input.summary || null,
    },
    update: data,
  });
  return getDay(userId, date);
}

/** Appends a note. Never touches existing notes. */
export async function addNote(
  userId: string,
  date: DateKey,
  content: string,
  source: NoteSource = NoteSource.MANUAL,
): Promise<NoteView> {
  const note = await db.$transaction(async (tx) => {
    const day = await ensureDay(userId, date, tx);
    return tx.note.create({
      data: { userId, dayId: day.id, content, source },
      select: noteSelect,
    });
  });
  return toNoteView(note);
}

export async function updateNote(
  userId: string,
  noteId: string,
  content: string,
): Promise<NoteView> {
  const { count } = await db.note.updateMany({
    where: { id: noteId, userId },
    data: { content },
  });
  if (count === 0) throw new NotFoundError("Note not found");
  const note = await db.note.findUniqueOrThrow({ where: { id: noteId }, select: noteSelect });
  return toNoteView(note);
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const { count } = await db.note.deleteMany({ where: { id: noteId, userId } });
  if (count === 0) throw new NotFoundError("Note not found");
}

/**
 * Stores imported commits on the right days. Idempotent: commits already
 * stored for this user (same SHA) are skipped, so retried webhook
 * deliveries never create duplicates. Never touches notes.
 */
export async function importCommits(
  userId: string,
  commits: CommitInput[],
  provider: "github" | "gitlab" | "bitbucket" = "github",
): Promise<{ imported: number; duplicates: number }> {
  if (commits.length === 0) return { imported: 0, duplicates: 0 };

  const byDate = new Map<DateKey, CommitInput[]>();
  for (const commit of commits) {
    const list = byDate.get(commit.date) ?? [];
    list.push(commit);
    byDate.set(commit.date, list);
  }

  const imported = await db.$transaction(async (tx) => {
    let count = 0;
    for (const [date, list] of byDate) {
      const day = await ensureDay(userId, date, tx);
      const result = await tx.commit.createMany({
        data: list.map((c) => ({
          userId,
          dayId: day.id,
          provider,
          sha: c.sha,
          repositoryId: c.repositoryId,
          repositoryName: c.repositoryName,
          message: c.message,
          branch: c.branch,
          url: c.url,
          authorName: c.authorName,
          authorEmail: c.authorEmail,
          committedAt: c.committedAt,
        })),
        skipDuplicates: true,
      });
      count += result.count;
    }
    return count;
  });

  return { imported, duplicates: commits.length - imported };
}
