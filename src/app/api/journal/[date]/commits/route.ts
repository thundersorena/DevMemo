import { getCommits } from "@/server/journal.service";
import { ok, parseQuery, withUser } from "@/server/http";
import { commitsQuerySchema, dateKeySchema } from "@/lib/validation";

/** GET /api/journal/:date/commits?repository= */
export const GET = withUser<RouteContext<"/api/journal/[date]/commits">>(
  async ({ req, ctx, user }) => {
    const date = dateKeySchema.parse((await ctx.params).date);
    const { repository } = parseQuery(req, commitsQuerySchema);
    return ok(await getCommits(user.id, date, repository));
  },
);
