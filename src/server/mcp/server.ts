import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { NoteSource } from "@/generated/prisma/client";
import { addDays, dateKeyToDb, formatLongDate, todayKey } from "@/lib/dates";
import {
  dateKeySchema,
  noteContentSchema,
  SUMMARY_MAX_LENGTH,
} from "@/lib/validation";
import { AppError } from "../errors";
import {
  addNote,
  getCommits,
  getDay,
  getMonth,
  getRange,
  searchJournal,
  updateDay,
} from "../journal.service";
import type { CurrentUser } from "../session";

const MAX_RANGE_DAYS = 62;

const SERVER_INSTRUCTIONS = `DevMemo is the user's personal developer journal.
Each date has: a workday flag, manual notes, imported Git commits, and an optional summary.
- Always call get_today first when the user refers to relative dates ("today", "yesterday", "this week").
- Answer only from data returned by these tools. Never invent work, decisions or commits.
- Notes describe what happened; commits describe what changed. Keep that distinction in answers.
- An investigation is not a completed task unless the notes or commits say so.
- add_note appends; it never edits or deletes existing notes.`;

function json(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function toolError(error: unknown): CallToolResult {
  const message =
    error instanceof z.ZodError
      ? error.issues.map((i) => i.message).join("; ")
      : error instanceof AppError
        ? error.message
        : "Internal error";
  if (!(error instanceof z.ZodError) && !(error instanceof AppError)) {
    console.error("[mcp] tool failed", error);
  }
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Wraps a tool handler with uniform error reporting. */
function safe<A>(handler: (args: A) => Promise<CallToolResult>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      return await handler(args);
    } catch (error) {
      return toolError(error);
    }
  };
}

const date = dateKeySchema.describe("Date in YYYY-MM-DD format");

/**
 * Builds an MCP server bound to one authenticated user. Every tool calls the
 * same journal service as the REST API and the web UI.
 */
export function createMcpServer(user: CurrentUser): McpServer {
  const server = new McpServer(
    { name: "devmemo", title: "DevMemo", version: "0.2.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "get_today",
    {
      title: "Get today's date",
      description:
        "Returns today's date in the user's timezone, plus yesterday and the current week (Monday to Sunday). Call this before resolving relative dates.",
      annotations: { readOnlyHint: true },
    },
    safe(async () => {
      const today = todayKey(user.timezone);
      const weekday = (dateKeyToDb(today).getUTCDay() + 6) % 7; // Monday = 0
      const weekStart = addDays(today, -weekday);
      return json({
        today,
        todayLabel: formatLongDate(today),
        yesterday: addDays(today, -1),
        weekStart,
        weekEnd: addDays(weekStart, 6),
        timezone: user.timezone,
      });
    }),
  );

  server.registerTool(
    "get_day",
    {
      title: "Get a journal day",
      description: "Full journal entry for one date: workday flag, notes (with source), commits and summary.",
      inputSchema: { date },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ date }) => json(await getDay(user.id, dateKeySchema.parse(date)))),
  );

  server.registerTool(
    "get_range",
    {
      title: "Get journal days in a range",
      description: `Full entries (notes and commits) for every day with activity between two dates, inclusive. At most ${MAX_RANGE_DAYS} days. Use this for weekly or multi-day summaries.`,
      inputSchema: {
        from: dateKeySchema.describe("Start date, YYYY-MM-DD (inclusive)"),
        to: dateKeySchema.describe("End date, YYYY-MM-DD (inclusive)"),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ from, to }) => {
      const start = dateKeySchema.parse(from);
      const end = dateKeySchema.parse(to);
      if (start > end) throw new z.ZodError([{ code: "custom", path: ["from"], message: "`from` must be on or before `to`", input: from }]);
      const span = (dateKeyToDb(end).getTime() - dateKeyToDb(start).getTime()) / 86_400_000 + 1;
      if (span > MAX_RANGE_DAYS) {
        throw new z.ZodError([{ code: "custom", path: ["to"], message: `Range cannot exceed ${MAX_RANGE_DAYS} days`, input: to }]);
      }
      return json({ from: start, to: end, days: await getRange(user.id, start, end) });
    }),
  );

  server.registerTool(
    "get_month",
    {
      title: "Get monthly overview",
      description:
        "Per-day overview of a month: workday flag and counts of notes and commits. Use get_day or get_range for the content.",
      inputSchema: {
        year: z.number().int().min(1970).max(9999),
        month: z.number().int().min(1).max(12).describe("Month number, 1-12"),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ year, month }) => json(await getMonth(user.id, { year, month }))),
  );

  server.registerTool(
    "get_commits",
    {
      title: "Get commits for a day",
      description: "Git commits imported for a date, optionally filtered by repository name (partial, case-insensitive).",
      inputSchema: {
        date,
        repository: z.string().trim().min(1).max(200).optional().describe("Repository name filter, e.g. 'smc' or 'owner/repo'"),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ date, repository }) =>
      json(await getCommits(user.id, dateKeySchema.parse(date), repository)),
    ),
  );

  server.registerTool(
    "search_journal",
    {
      title: "Search the journal",
      description:
        "Text search across notes, commit messages, repository names and summaries. Returns matches with their dates, newest first.",
      inputSchema: {
        query: z.string().trim().min(2).max(200),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ query, limit }) => json(await searchJournal(user.id, query, limit ?? 30))),
  );

  server.registerTool(
    "add_note",
    {
      title: "Add a note",
      description:
        "Appends a note to a date. Existing notes are never changed. The note is marked as added via AI. Write it in the user's voice and keep it factual.",
      inputSchema: { date, note: noteContentSchema.describe("Note text") },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    safe(async ({ date, note }) =>
      json(await addNote(user.id, dateKeySchema.parse(date), noteContentSchema.parse(note), NoteSource.MCP)),
    ),
  );

  server.registerTool(
    "update_day",
    {
      title: "Update a day",
      description:
        "Sets the workday flag and/or the day's summary. Use `summary` to save a summary you wrote from get_day data; it replaces any previous summary and never touches notes. Pass summary: null to clear it.",
      inputSchema: {
        date,
        isWorkDay: z.boolean().optional(),
        summary: z.string().trim().max(SUMMARY_MAX_LENGTH).nullable().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    safe(async ({ date, isWorkDay, summary }) => {
      if (isWorkDay === undefined && summary === undefined) {
        throw new z.ZodError([{ code: "custom", path: [], message: "Provide isWorkDay and/or summary", input: {} }]);
      }
      return json(await updateDay(user.id, dateKeySchema.parse(date), { isWorkDay, summary }));
    }),
  );

  return server;
}
