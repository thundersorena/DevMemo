import { addNote } from "@/server/journal.service";
import { ok, parseJson, withUser } from "@/server/http";
import { createNoteSchema, dateKeySchema } from "@/lib/validation";

/** POST /api/journal/:date/notes — append a note: { content } */
export const POST = withUser<RouteContext<"/api/journal/[date]/notes">>(
  async ({ req, ctx, user }) => {
    const date = dateKeySchema.parse((await ctx.params).date);
    const { content } = await parseJson(req, createNoteSchema);
    return ok(await addNote(user.id, date, content), { status: 201 });
  },
);
