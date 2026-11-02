import "server-only";
import { db } from "./db";

export async function updateUserTimezone(userId: string, timezone: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { timezone } });
}
