import type { Metadata } from "next";
import { Suspense } from "react";
import { MonthCalendar, MonthCalendarSkeleton } from "@/components/calendar/month-calendar";
import { getMonth } from "@/server/journal.service";
import { requireUser } from "@/server/session";
import { monthOf, parseMonthParam, todayKey } from "@/lib/dates";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <Suspense fallback={<MonthCalendarSkeleton />}>
      <CalendarContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CalendarContent({ searchParams }: Pick<PageProps<"/calendar">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayKey(user.timezone);
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const month = parseMonthParam(monthParam) ?? monthOf(today);
  const data = await getMonth(user.id, month);

  return <MonthCalendar month={month} data={data} today={today} />;
}
