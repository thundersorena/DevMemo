/**
 * Date helpers.
 *
 * A journal date is a "date key": a plain `YYYY-MM-DD` string in the user's
 * timezone. In Postgres it is stored as a `DATE` column, which Prisma maps to
 * a JS Date at UTC midnight. All arithmetic here is done in UTC on those
 * midnight values, so it never drifts with the server's local timezone.
 */

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateKey = string;

export function isValidDateKey(value: string): value is DateKey {
  const match = DATE_KEY_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** `YYYY-MM-DD` → Date at UTC midnight (the value Prisma uses for `@db.Date`). */
export function dateKeyToDb(key: DateKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Date at UTC midnight → `YYYY-MM-DD`. */
export function dbToDateKey(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date of `instant` as seen in `timeZone`. */
export function dateKeyInTimeZone(instant: Date, timeZone: string): DateKey {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function todayKey(timeZone: string): DateKey {
  return dateKeyInTimeZone(new Date(), timeZone);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = dateKeyToDb(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dbToDateKey(date);
}

export type MonthKey = { year: number; month: number }; // month is 1-12

export function isValidMonth(year: number, month: number): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    year >= 1970 &&
    year <= 9999 &&
    month >= 1 &&
    month <= 12
  );
}

export function monthOf(key: DateKey): MonthKey {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

export function addMonths({ year, month }: MonthKey, delta: number): MonthKey {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function formatMonthParam({ year, month }: MonthKey): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthParam(value: string | undefined): MonthKey | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return isValidMonth(year, month) ? { year, month } : null;
}

/** First and last date keys of a month (inclusive). */
export function monthRange({ year, month }: MonthKey): { start: DateKey; end: DateKey } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start: dbToDateKey(start), end: dbToDateKey(end) };
}

/**
 * The date keys shown on a month grid: whole weeks (Monday first) that
 * cover the month. Always 5 or 6 rows of 7.
 */
export function monthGrid(month: MonthKey): DateKey[] {
  const { start, end } = monthRange(month);
  const first = dateKeyToDb(start);
  const last = dateKeyToDb(end);
  const leading = (first.getUTCDay() + 6) % 7; // Monday = 0
  const trailing = 6 - ((last.getUTCDay() + 6) % 7);
  const days: DateKey[] = [];
  for (let i = -leading; i <= Math.round((last.getTime() - first.getTime()) / 86_400_000) + trailing; i++) {
    days.push(addDays(start, i));
  }
  return days;
}

const WEEKDAY_LONG = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const MONTH_LONG = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "Monday, November 2, 2026" */
export function formatLongDate(key: DateKey): string {
  return WEEKDAY_LONG.format(dateKeyToDb(key));
}

/** "November 2026" */
export function formatMonthTitle({ year, month }: MonthKey): string {
  return MONTH_LONG.format(new Date(Date.UTC(year, month - 1, 1)));
}

/** "14:32" in the given timezone. */
export function formatTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

/** Monday-to-Sunday week containing `key` (offset in weeks, e.g. -1 = previous week). */
export function weekRange(key: DateKey, offsetWeeks = 0): { start: DateKey; end: DateKey } {
  const weekday = (dateKeyToDb(key).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(key, -weekday + offsetWeeks * 7);
  return { start, end: addDays(start, 6) };
}
