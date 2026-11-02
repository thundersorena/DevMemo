import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dateKeyInTimeZone,
  isValidDateKey,
  monthGrid,
  monthRange,
  parseMonthParam,
} from "./dates";

describe("isValidDateKey", () => {
  it("accepts real dates", () => {
    expect(isValidDateKey("2026-11-02")).toBe(true);
    expect(isValidDateKey("2028-02-29")).toBe(true);
  });
  it("rejects impossible or malformed dates", () => {
    for (const v of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-1-01", "20261102", "", "2026-11-02T00:00"]) {
      expect(isValidDateKey(v)).toBe(false);
    }
  });
});

describe("dateKeyInTimeZone", () => {
  // 2026-11-02 21:00 UTC is already Nov 3 in Tehran (UTC+3:30) but still Nov 2 in New York.
  const instant = new Date("2026-11-02T21:00:00Z");
  it("uses the given timezone, not UTC", () => {
    expect(dateKeyInTimeZone(instant, "Asia/Tehran")).toBe("2026-11-03");
    expect(dateKeyInTimeZone(instant, "America/New_York")).toBe("2026-11-02");
    expect(dateKeyInTimeZone(instant, "UTC")).toBe("2026-11-02");
  });
});

describe("date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("adds months across years", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
  it("computes month ranges", () => {
    expect(monthRange({ year: 2028, month: 2 })).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
  it("parses month params", () => {
    expect(parseMonthParam("2026-11")).toEqual({ year: 2026, month: 11 });
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam(undefined)).toBeNull();
  });
});

describe("monthGrid", () => {
  it("covers whole Monday-first weeks", () => {
    const grid = monthGrid({ year: 2026, month: 11 });
    expect(grid.length % 7).toBe(0);
    expect(grid[0]).toBe("2026-10-26"); // Monday
    expect(grid.at(-1)).toBe("2026-12-06"); // Sunday
    expect(grid).toContain("2026-11-30");
  });
});
