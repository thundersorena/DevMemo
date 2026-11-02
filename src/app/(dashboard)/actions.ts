"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { addNote, deleteNote, updateDay, updateNote } from "@/server/journal.service";
import { requireUser } from "@/server/session";
import { updateUserTimezone } from "@/server/user.service";
import {
  createHook,
  deleteHook,
  revealHookSecret,
  rotateHookSecret,
  setOnlyOwnCommits,
} from "@/server/github/github.service";
import { createToken, revokeToken } from "@/server/api-token.service";
import { AppError } from "@/server/errors";
import {
  dateKeySchema,
  noteContentSchema,
  updateSettingsSchema,
} from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SecretResult = { ok: true; secret: string } | { ok: false; error: string };

const noteIdSchema = z.string().min(1).max(64);

function failure(error: unknown): { ok: false; error: string } {
  // Let redirect() (e.g. from requireUser when signed out) propagate.
  unstable_rethrow(error);
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Invalid input" };
  }
  if (error instanceof AppError) {
    return { ok: false, error: error.message };
  }
  console.error("[action] unhandled error", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function revalidateDay(date: string) {
  revalidatePath(`/journal/${date}`);
  revalidatePath("/calendar");
}

export async function setWorkDayAction(date: string, isWorkDay: boolean): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const key = dateKeySchema.parse(date);
    await updateDay(user.id, key, { isWorkDay: z.boolean().parse(isWorkDay) });
    revalidateDay(key);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function addNoteAction(
  date: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const key = dateKeySchema.parse(date);
    const content = noteContentSchema.parse(formData.get("content"));
    await addNote(user.id, key, content);
    revalidateDay(key);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function updateNoteAction(
  date: string,
  noteId: string,
  content: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await updateNote(user.id, noteIdSchema.parse(noteId), noteContentSchema.parse(content));
    revalidateDay(dateKeySchema.parse(date));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteNoteAction(date: string, noteId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await deleteNote(user.id, noteIdSchema.parse(noteId));
    revalidateDay(dateKeySchema.parse(date));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function updateSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { timezone } = updateSettingsSchema.parse({ timezone: formData.get("timezone") });
    await updateUserTimezone(user.id, timezone);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ─── GitHub webhook ─────────────────────────────────────────────────────────

export async function createHookAction(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await createHook(user.id);
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function revealHookSecretAction(): Promise<SecretResult> {
  try {
    const user = await requireUser();
    return { ok: true, secret: await revealHookSecret(user.id) };
  } catch (error) {
    return failure(error);
  }
}

export async function rotateHookSecretAction(): Promise<SecretResult> {
  try {
    const user = await requireUser();
    const secret = await rotateHookSecret(user.id);
    revalidatePath("/settings");
    return { ok: true, secret };
  } catch (error) {
    return failure(error);
  }
}

export async function setOnlyOwnCommitsAction(value: boolean): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await setOnlyOwnCommits(user.id, z.boolean().parse(value));
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteHookAction(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await deleteHook(user.id);
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ─── API / MCP tokens ───────────────────────────────────────────────────────

const tokenNameSchema = z.string().trim().min(1, "Give the token a name").max(60);

export async function createTokenAction(
  _prev: SecretResult | null,
  formData: FormData,
): Promise<SecretResult> {
  try {
    const user = await requireUser();
    const name = tokenNameSchema.parse(formData.get("name"));
    const { token } = await createToken(user.id, name);
    revalidatePath("/settings");
    return { ok: true, secret: token };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeTokenAction(tokenId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await revokeToken(user.id, z.string().min(1).max(64).parse(tokenId));
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
