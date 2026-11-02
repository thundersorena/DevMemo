import "server-only";
import { db } from "./db";
import { NotFoundError } from "./errors";

/** OAuth (MCP) clients the user has authorized. */

export type ConnectedAppView = {
  clientId: string;
  name: string;
  icon: string | null;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
};

export async function listConnectedApps(userId: string): Promise<ConnectedAppView[]> {
  const consents = await db.oauthConsent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (consents.length === 0) return [];

  const clientIds = [...new Set(consents.map((c) => c.clientId))];
  const [clients, lastTokens] = await Promise.all([
    db.oauthClient.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, name: true, icon: true },
    }),
    db.oauthRefreshToken.groupBy({
      by: ["clientId"],
      where: { userId, clientId: { in: clientIds } },
      _max: { createdAt: true },
    }),
  ]);
  const clientById = new Map(clients.map((c) => [c.clientId, c]));
  const lastUsed = new Map(lastTokens.map((t) => [t.clientId, t._max.createdAt]));

  const seen = new Set<string>();
  const apps: ConnectedAppView[] = [];
  for (const consent of consents) {
    if (seen.has(consent.clientId)) continue;
    seen.add(consent.clientId);
    const client = clientById.get(consent.clientId);
    apps.push({
      clientId: consent.clientId,
      name: client?.name || "Unnamed app",
      icon: client?.icon ?? null,
      scopes: consent.scopes,
      connectedAt: (consent.createdAt ?? new Date()).toISOString(),
      lastUsedAt: lastUsed.get(consent.clientId)?.toISOString() ?? null,
    });
  }
  return apps;
}

/**
 * Revokes an app: removes the consent and its refresh tokens, so it can't get
 * new access tokens. An already-issued access token expires on its own
 * (short-lived), and the app must ask for consent again to reconnect.
 */
export async function revokeConnectedApp(userId: string, clientId: string): Promise<void> {
  const [consents] = await db.$transaction([
    db.oauthConsent.deleteMany({ where: { userId, clientId } }),
    db.oauthRefreshToken.deleteMany({ where: { userId, clientId } }),
    db.oauthAccessToken.deleteMany({ where: { userId, clientId } }),
  ]);
  if (consents.count === 0) throw new NotFoundError("App not found");
}

/** Display name of a registered OAuth client (for the sign-in page). */
export async function getClientName(clientId: string): Promise<string | null> {
  const client = await db.oauthClient.findUnique({
    where: { clientId },
    select: { name: true, disabled: true },
  });
  if (!client || client.disabled) return null;
  return client.name || "An application";
}
