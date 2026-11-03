import { formatLongDate, formatTime } from "@/lib/dates";
import type { DayView } from "./journal.service";

const SOURCE_TAG: Record<string, string> = { MCP: " _(via AI)_", TELEGRAM: " _(via Telegram)_" };

function quote(text: string): string {
  return text
    .trim()
    .split("\n")
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join("\n");
}

export function dayToMarkdown(day: DayView, timeZone: string, headingLevel = 2): string {
  const h = "#".repeat(headingLevel);
  const lines: string[] = [`${h} ${formatLongDate(day.date)}${day.isWorkDay ? " · workday" : ""}`, ""];

  if (day.summary) lines.push(`**Summary:** ${day.summary.trim()}`, "");

  if (day.notes.length) {
    lines.push(`${h}# Notes`);
    for (const note of day.notes) {
      lines.push(`- ${formatTime(new Date(note.createdAt), timeZone)} ${quote(note.content)}${SOURCE_TAG[note.source] ?? ""}`);
    }
    lines.push("");
  }

  if (day.commits.length) {
    lines.push(`${h}# Commits`);
    const byRepo = new Map<string, DayView["commits"]>();
    for (const c of day.commits) {
      const key = c.provider === "github" ? c.repositoryName : `${c.repositoryName} (${c.provider})`;
      byRepo.set(key, [...(byRepo.get(key) ?? []), c]);
    }
    for (const [repo, commits] of byRepo) {
      lines.push(`- **${repo}**`);
      for (const c of commits) {
        const branch = c.branch ? ` [${c.branch}]` : "";
        lines.push(`  - \`${c.sha.slice(0, 7)}\` ${c.message.split("\n")[0]}${branch} (${formatTime(new Date(c.committedAt), timeZone)})`);
      }
    }
    lines.push("");
  }

  if (!day.summary && !day.notes.length && !day.commits.length) lines.push("_No notes or commits._", "");
  return lines.join("\n");
}

export function daysToMarkdown(days: DayView[], timeZone: string, title?: string): string {
  const parts = title ? [`# ${title}`, ""] : [];
  if (days.length === 0) parts.push("_No journal activity in this period._");
  for (const day of days) parts.push(dayToMarkdown(day, timeZone));
  return parts.join("\n").trimEnd() + "\n";
}

function csvCell(value: string | null | undefined): string {
  const v = value ?? "";
  // Neutralize spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const CSV_HEADER = ["date", "type", "time", "source", "repository", "sha", "branch", "text", "url"];

export function daysToCsv(days: DayView[], timeZone: string): string {
  const rows: string[][] = [CSV_HEADER];
  for (const day of days) {
    if (day.summary) rows.push([day.date, "summary", "", "", "", "", "", day.summary, ""]);
    for (const n of day.notes) {
      rows.push([day.date, "note", formatTime(new Date(n.createdAt), timeZone), n.source.toLowerCase(), "", "", "", n.content, ""]);
    }
    for (const c of day.commits) {
      rows.push([
        day.date,
        "commit",
        formatTime(new Date(c.committedAt), timeZone),
        c.provider,
        c.repositoryName,
        c.sha,
        c.branch ?? "",
        c.message,
        c.url,
      ]);
    }
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
