import { z } from "zod";
import { deleteNote, updateNote } from "@/server/journal.service";
import { noContent, ok, parseJson, withUser } from "@/server/http";
import { updateNoteSchema } from "@/lib/validation";

const idSchema = z.string().min(1).max(64);

/** PATCH /api/notes/:id — { content } */
export const PATCH = withUser<RouteContext<"/api/notes/[id]">>(async ({ req, ctx, user }) => {
  const id = idSchema.parse((await ctx.params).id);
  const { content } = await parseJson(req, updateNoteSchema);
  return ok(await updateNote(user.id, id, content));
});

/** DELETE /api/notes/:id */
export const DELETE = withUser<RouteContext<"/api/notes/[id]">>(async ({ ctx, user }) => {
  const id = idSchema.parse((await ctx.params).id);
  await deleteNote(user.id, id);
  return noContent();
});
