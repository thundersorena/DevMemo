import { searchJournal } from "@/server/search.service";
import { ok, parseQuery, withUser } from "@/server/http";
import { searchQuerySchema } from "@/lib/validation";

/** GET /api/journal/search?q=&type=note,commit&from=&to=&repository=&limit= */
export const GET = withUser<unknown>(async ({ req, user }) => {
  const { q, limit, type, from, to, repository } = parseQuery(req, searchQuerySchema);
  return ok(await searchJournal(user.id, q, { limit, types: type, from, to, repository }));
});
