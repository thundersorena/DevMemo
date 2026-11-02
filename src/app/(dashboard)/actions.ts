"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { addNote, deleteNote, updateDay, updateNote } from "@/server/journal.service";
import { requireUser } from "@/server/session";
import { updateAuthorEmails, updateOnlyOwnCommits, updateUserTimezone } from "@/server/user.service";
import {
  createProviderHook,
  deleteProviderHook,
  revealProviderSecret,
  rotateProviderSecret,
} from "@/server/git/provider-hooks.service";
import { PROVIDERS } from "@/server/git/providers";
import { revokeConnectedApp } from "@/server/oauth-apps.service";
import {
  createHook,
  deleteHook,
  revealHookSecret,
  rotateHookSecret,
} from "@/server/github/github.service";
import {
  backfillRepositories,
  requestReimport,
  unlinkInstallation,
} from "@/server/github/app.service";
import { createToken, revokeToken } from "@/server/api-token.service";
import { AppError } from "@/server/errors";
import {
  authorEmailsSchema,
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
    await updateOnlyOwnCommits(user.id, z.boolean().parse(value));
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

// ─── GitHub App ─────────────────────────────────────────────────────────────

export async function reimportHistoryAction(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const ids = await requestReimport(user.id);
    if (ids.length) after(() => backfillRepositories(ids));
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function unlinkInstallationAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await unlinkInstallation(user.id, z.string().min(1).max(64).parse(id));
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ─── GitLab / Bitbucket webhooks ────────────────────────────────────────────

const providerSchema = z.enum(PROVIDERS);

export async function createProviderHookAction(provider: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await createProviderHook(user.id, providerSchema.parse(provider));
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function revealProviderSecretAction(provider: string): Promise<SecretResult> {
  try {
    const user = await requireUser();
    return { ok: true, secret: await revealProviderSecret(user.id, providerSchema.parse(provider)) };
  } catch (error) {
    return failure(error);
  }
}

export async function rotateProviderSecretAction(provider: string): Promise<SecretResult> {
  try {
    const user = await requireUser();
    const secret = await rotateProviderSecret(user.id, providerSchema.parse(provider));
    revalidatePath("/settings");
    return { ok: true, secret };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteProviderHookAction(provider: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await deleteProviderHook(user.id, providerSchema.parse(provider));
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ─── Commit emails ──────────────────────────────────────────────────────────

export async function updateAuthorEmailsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const raw = String(formData.get("emails") ?? "");
    const emails = authorEmailsSchema.parse(
      raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean),
    );
    await updateAuthorEmails(user.id, [...new Set(emails)]);
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ─── Connected OAuth apps (MCP) ─────────────────────────────────────────────

export async function revokeConnectedAppAction(clientId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await revokeConnectedApp(user.id, z.string().min(1).max(512).parse(clientId));
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
