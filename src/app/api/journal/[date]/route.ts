import { getDay, updateDay } from "@/server/journal.service";
import { ok, parseJson, withUser } from "@/server/http";
import { dateKeySchema, updateDaySchema } from "@/lib/validation";

/** GET /api/journal/:date — full day: workday flag, notes, commits, summary. */
export const GET = withUser<RouteContext<"/api/journal/[date]">>(async ({ ctx, user }) => {
  const date = dateKeySchema.parse((await ctx.params).date);
  return ok(await getDay(user.id, date));
});

/** PATCH /api/journal/:date — { isWorkDay?, summary? } */
export const PATCH = withUser<RouteContext<"/api/journal/[date]">>(async ({ req, ctx, user }) => {
  const date = dateKeySchema.parse((await ctx.params).date);
  const input = await parseJson(req, updateDaySchema);
  return ok(await updateDay(user.id, date, input));
});
