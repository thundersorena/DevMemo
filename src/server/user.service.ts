import "server-only";
import { db } from "./db";

export async function updateUserTimezone(userId: string, timezone: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { timezone } });
}

export async function updateOnlyOwnCommits(userId: string, onlyOwnCommits: boolean): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { onlyOwnCommits } });
}

export async function getImportPreferences(
  userId: string,
): Promise<{ onlyOwnCommits: boolean; authorEmails: string[]; accountEmail: string }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { onlyOwnCommits: true, authorEmails: true, email: true },
  });
  return {
    onlyOwnCommits: user?.onlyOwnCommits ?? true,
    authorEmails: user?.authorEmails ?? [],
    accountEmail: user?.email ?? "",
  };
}

export async function updateAuthorEmails(userId: string, authorEmails: string[]): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { authorEmails } });
}
