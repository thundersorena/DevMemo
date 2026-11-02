import { describe, expect, it } from "vitest";
import { dayToMarkdown, daysToMarkdown } from "./journal-format";
import type { DayView } from "./journal.service";

const day: DayView = {
  date: "2026-11-02",
  isWorkDay: true,
  summary: "Shipped webhook auth.",
  notes: [
    { id: "n1", content: "Investigated 401s\nRoot cause: raw body", source: "MANUAL", createdAt: "2026-11-02T06:30:00.000Z", updatedAt: "" },
    { id: "n2", content: "Decided to verify HMAC first", source: "MCP", createdAt: "2026-11-02T09:00:00.000Z", updatedAt: "" },
  ],
  commits: [
    { id: "c1", provider: "github", sha: "a".repeat(40), repositoryId: "1", repositoryName: "acme/api", message: "Fix auth\n\nExtended details", branch: "main", url: "", authorName: null, committedAt: "2026-11-02T08:00:00.000Z" },
    { id: "c2", provider: "gitlab", sha: "b".repeat(40), repositoryId: "2", repositoryName: "acme/api", message: "Mirror", branch: null, url: "", authorName: null, committedAt: "2026-11-02T08:30:00.000Z" },
  ],
};

describe("dayToMarkdown", () => {
  const md = dayToMarkdown(day, "Asia/Tehran");

  it("renders heading, summary, notes with times and sources", () => {
    expect(md).toContain("## Monday, November 2, 2026 · workday");
    expect(md).toContain("**Summary:** Shipped webhook auth.");
    expect(md).toContain("- 10:00 Investigated 401s\n  Root cause: raw body");
    expect(md).toContain("- 12:30 Decided to verify HMAC first _(via AI)_");
  });

  it("groups commits by repository and provider, first line only", () => {
    expect(md).toContain("- **acme/api**\n  - `aaaaaaa` Fix auth [main] (11:30)");
    expect(md).toContain("- **acme/api (gitlab)**\n  - `bbbbbbb` Mirror (12:00)");
    expect(md).not.toContain("Extended details");
  });

  it("marks empty days and ranges", () => {
    expect(dayToMarkdown({ ...day, summary: null, notes: [], commits: [] }, "UTC")).toContain("_No notes or commits._");
    expect(daysToMarkdown([], "UTC", "Week")).toBe("# Week\n\n_No journal activity in this period._\n");
  });
});

import { daysToCsv } from "./journal-format";

describe("daysToCsv", () => {
  const csv = daysToCsv([day], "UTC");
  const lines = csv.trimEnd().split("\r\n");

  it("has a header and one row per summary, note and commit", () => {
    expect(lines[0]).toBe("date,type,time,source,repository,sha,branch,text,url");
    expect(csv.split("\r\n").filter((l) => l.startsWith("2026-11-02,")).length).toBe(5);
  });

  it("quotes multi-line text and lowercases sources", () => {
    expect(csv).toContain('2026-11-02,note,06:30,manual,,,,"Investigated 401s\nRoot cause: raw body",');
    expect(csv).toContain("2026-11-02,note,09:00,mcp,,,,Decided to verify HMAC first,");
  });

  it("neutralizes spreadsheet formulas", () => {
    const evil = daysToCsv([{ ...day, summary: null, commits: [], notes: [{ ...day.notes[0], content: "=HYPERLINK(1)" }] }], "UTC");
    expect(evil).toContain(",'=HYPERLINK(1),");
  });
});
