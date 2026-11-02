import { getMonth } from "@/server/journal.service";
import { ok, withUser } from "@/server/http";
import { monthSchema } from "@/lib/validation";

/** GET /api/journal/month/:year/:month — calendar data for a month. */
export const GET = withUser<RouteContext<"/api/journal/month/[year]/[month]">>(
  async ({ ctx, user }) => {
    const month = monthSchema.parse(await ctx.params);
    return ok(await getMonth(user.id, month));
  },
);
