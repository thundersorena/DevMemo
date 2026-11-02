import { searchJournal } from "@/server/journal.service";
import { ok, parseQuery, withUser } from "@/server/http";
import { searchQuerySchema } from "@/lib/validation";

/** GET /api/journal/search?q=&limit= */
export const GET = withUser<unknown>(async ({ req, user }) => {
  const { q, limit } = parseQuery(req, searchQuerySchema);
  return ok(await searchJournal(user.id, q, limit));
});
