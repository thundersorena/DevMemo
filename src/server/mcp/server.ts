import "server-only";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { NoteSource } from "@/generated/prisma/client";
import {
  addDays,
  dateKeyToDb,
  formatLongDate,
  isValidDateKey,
  todayKey,
  weekRange,
  type DateKey,
} from "@/lib/dates";
import { dayToMarkdown, daysToMarkdown } from "../journal-format";
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
  updateDay,
} from "../journal.service";
import { searchJournal } from "../search.service";
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
        'Full-text search across notes, commit messages, repository names and summaries, ranked by relevance. Supports "exact phrases", OR, and -excluded words. Returns full matching texts with their dates, best matches first.',
      inputSchema: {
        query: z.string().trim().min(2).max(200),
        types: z.array(z.enum(["note", "commit", "summary"])).optional().describe("Limit to these result types"),
        from: dateKeySchema.optional().describe("Only on or after this date (YYYY-MM-DD)"),
        to: dateKeySchema.optional().describe("Only on or before this date (YYYY-MM-DD)"),
        repository: z.string().trim().min(1).max(200).optional().describe("Only commits from this exact repository name"),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ query, types, from, to, repository, limit }) =>
      json(
        (await searchJournal(user.id, query, { types, from, to, repository, limit: limit ?? 30 })).map(
          // Models get the full text; the excerpt is for the web UI.
          (result) => {
            const { snippet, ...rest } = result;
            void snippet;
            return rest;
          },
        ),
      ),
    ),
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

  registerPrompts(server, user);
  registerResources(server, user);
  return server;
}

// ─── Prompts ───────────────────────────────────────────────────────────────

const GROUNDING = `Use only the journal data above. Don't invent work, decisions or outcomes. Notes describe what happened; commits describe what changed. An investigation is not a finished task unless the data says so. If the data is thin, say so briefly instead of padding.`;

function resolveDate(input: string | undefined, today: DateKey): DateKey {
  const value = input?.trim().toLowerCase();
  if (!value || value === "today") return today;
  if (value === "yesterday") return addDays(today, -1);
  if (isValidDateKey(value)) return value;
  throw new McpError(ErrorCode.InvalidParams, `Invalid date "${input}". Use YYYY-MM-DD, "today" or "yesterday".`);
}

function promptText(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

function registerPrompts(server: McpServer, user: CurrentUser) {
  server.registerPrompt(
    "weekly_report",
    {
      title: "Weekly report",
      description: "Write a weekly development report from your DevMemo journal (notes + commits).",
      argsSchema: {
        week: z
          .string()
          .optional()
          .describe("'this' (default), 'last', or any date (YYYY-MM-DD) inside the week"),
      },
    },
    async ({ week }) => {
      const today = todayKey(user.timezone);
      const value = week?.trim().toLowerCase();
      const anchor = !value || value === "this" ? today : value === "last" ? addDays(today, -7) : resolveDate(value, today);
      const { start, end } = weekRange(anchor);
      const days = await getRange(user.id, start, end);
      const journal = daysToMarkdown(days, user.timezone, `Journal ${start} → ${end}`);
      return promptText(`${journal}
---
Write my weekly development report for ${formatLongDate(start)} – ${formatLongDate(end)}.

Structure:
1. **Highlights**: the 3–5 most important things, one line each.
2. **By project**: a short paragraph per repository/project.
3. **Decisions**: technical decisions recorded in notes.
4. **Investigations & open items**: what was explored, what's unresolved or blocked.

${GROUNDING}`);
    },
  );

  server.registerPrompt(
    "daily_standup",
    {
      title: "Daily standup",
      description: "Draft a standup update (yesterday / today / blockers) from your journal.",
      argsSchema: { date: z.string().optional().describe("The standup day: 'today' (default) or YYYY-MM-DD") },
    },
    async ({ date }) => {
      const day = resolveDate(date, todayKey(user.timezone));
      // "Yesterday" = the most recent earlier day with activity (skips weekends and days off).
      const recent = await getRange(user.id, addDays(day, -7), addDays(day, -1));
      const previous = recent.at(-1);
      const current = await getDay(user.id, day);
      const context = [
        previous ? dayToMarkdown(previous, user.timezone) : "_No activity in the previous 7 days._\n",
        dayToMarkdown(current, user.timezone),
      ].join("\n");
      return promptText(`${context}
---
Draft my standup for ${formatLongDate(day)} in three short sections: **Yesterday** (from ${
        previous ? formatLongDate(previous.date) : "the previous working day"
      }), **Today** (plans or work already logged today), **Blockers**. Bullet points, at most 5 per section, plain language a teammate can scan.

${GROUNDING}`);
    },
  );

  server.registerPrompt(
    "summarize_day",
    {
      title: "Summarize a day",
      description: "Summarize one journal day and save the summary to DevMemo.",
      argsSchema: { date: z.string().optional().describe("'today' (default), 'yesterday' or YYYY-MM-DD") },
    },
    async ({ date }) => {
      const day = resolveDate(date, todayKey(user.timezone));
      const entry = await getDay(user.id, day);
      return promptText(`${dayToMarkdown(entry, user.timezone)}
---
Write a 2–5 sentence summary of this day: what I worked on, what was decided, what's still open. Then save it by calling the \`update_day\` tool with \`date: "${day}"\` and \`summary\` set to your text. ${
        entry.summary ? "It replaces the existing summary shown above." : ""
      }

${GROUNDING}`);
    },
  );
}

// ─── Resources ─────────────────────────────────────────────────────────────

const RECENT_DAYS = 30;

function registerResources(server: McpServer, user: CurrentUser) {
  server.registerResource(
    "journal-day",
    new ResourceTemplate("devmemo://day/{date}", {
      // Recent days with activity, newest first.
      list: async () => {
        const today = todayKey(user.timezone);
        const days = await getRange(user.id, addDays(today, -(RECENT_DAYS - 1)), today);
        return {
          resources: days.reverse().map((d) => ({
            uri: `devmemo://day/${d.date}`,
            name: d.date,
            title: formatLongDate(d.date),
            mimeType: "text/markdown",
            description: `${d.notes.length} note(s), ${d.commits.length} commit(s)${d.isWorkDay ? ", workday" : ""}`,
          })),
        };
      },
    }),
    {
      title: "Journal day",
      description: "One day of your DevMemo journal (notes, commits, summary) as Markdown.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const raw = Array.isArray(variables.date) ? variables.date[0] : variables.date;
      const date = resolveDate(raw, todayKey(user.timezone));
      const day = await getDay(user.id, date);
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: dayToMarkdown(day, user.timezone, 1) }] };
    },
  );

  server.registerResource(
    "journal-this-week",
    "devmemo://week/current",
    {
      title: "This week",
      description: "Your journal for the current week (Monday to Sunday) as Markdown.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const { start, end } = weekRange(todayKey(user.timezone));
      const days = await getRange(user.id, start, end);
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: daysToMarkdown(days, user.timezone, `Week ${start} → ${end}`) }],
      };
    },
  );
}
