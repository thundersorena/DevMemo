import "server-only";
import { db } from "./db";
import { randomToken, sha256Hex } from "./crypto";
import { env } from "./env";
import { BadRequestError, NotFoundError } from "./errors";
import type { CurrentUser } from "./session";

export const TOKEN_PREFIX = "dm_";
const MAX_TOKENS_PER_USER = 20;
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

export type ApiTokenView = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export async function listTokens(userId: string): Promise<ApiTokenView[]> {
  const tokens = await db.apiToken.findMany({
    where: { userId },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return tokens.map((t) => ({
    ...t,
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));
}

/** Creates a token. The plaintext is returned once and never stored. */
export async function createToken(
  userId: string,
  name: string,
): Promise<{ token: string; view: ApiTokenView }> {
  const count = await db.apiToken.count({ where: { userId } });
  if (count >= MAX_TOKENS_PER_USER) {
    throw new BadRequestError(`You can have at most ${MAX_TOKENS_PER_USER} tokens. Revoke one first.`);
  }
  const token = randomToken(TOKEN_PREFIX);
  const record = await db.apiToken.create({
    data: { userId, name, tokenHash: sha256Hex(token), prefix: token.slice(0, 10) },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  });
  return {
    token,
    view: { ...record, lastUsedAt: null, createdAt: record.createdAt.toISOString() },
  };
}

export async function revokeToken(userId: string, tokenId: string): Promise<void> {
  const { count } = await db.apiToken.deleteMany({ where: { id: tokenId, userId } });
  if (count === 0) throw new NotFoundError("Token not found");
}

export async function authenticateToken(token: string): Promise<CurrentUser | null> {
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 200) return null;

  const record = await db.apiToken.findUnique({
    where: { tokenHash: sha256Hex(token) },
    select: {
      id: true,
      lastUsedAt: true,
      user: { select: { id: true, name: true, email: true, image: true, timezone: true } },
    },
  });
  if (!record) return null;

  // Track usage without writing on every request.
  const now = Date.now();
  if (!record.lastUsedAt || now - record.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await db.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date(now) } });
  }

  const { user } = record;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    timezone: user.timezone || env().APP_TIMEZONE,
  };
}

export function bearerToken(headers: Headers): string | null {
  const header = headers.get("authorization");
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return match ? match[1] : null;
}
