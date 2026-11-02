import { BadRequestError } from "@/server/errors";
import { parseQuery, withUser } from "@/server/http";
import { daysToCsv, daysToMarkdown } from "@/server/journal-format";
import { getFirstDate, getRange } from "@/server/journal.service";
import { exportQuerySchema } from "@/lib/validation";
import { todayKey } from "@/lib/dates";

const CONTENT_TYPE = {
  md: "text/markdown; charset=utf-8",
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
} as const;

/**
 * GET /api/export?format=md|json|csv&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Downloads the journal (default: everything). Session or `dm_` token.
 */
export const GET = withUser<unknown>(async ({ req, user }) => {
  const { format, from, to } = parseQuery(req, exportQuerySchema);
  const end = to ?? todayKey(user.timezone);
  const start = from ?? (await getFirstDate(user.id)) ?? end;
  if (start > end) throw new BadRequestError("`from` must be on or before `to`");

  const days = await getRange(user.id, start, end);
  const title = `DevMemo journal ${start} → ${end}`;
  const body =
    format === "json"
      ? JSON.stringify({ exportedAt: new Date().toISOString(), timezone: user.timezone, from: start, to: end, days }, null, 2)
      : format === "csv"
        ? // BOM so Excel opens UTF-8 (e.g. Persian text) correctly.
          `﻿${daysToCsv(days, user.timezone)}`
        : daysToMarkdown(days, user.timezone, title);

  return new Response(body, {
    headers: {
      "Content-Type": CONTENT_TYPE[format],
      "Content-Disposition": `attachment; filename="devmemo-${start}_${end}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
});
