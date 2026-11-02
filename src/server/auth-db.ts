import "server-only";
import { db } from "./db";

/**
 * Better Auth's Prisma adapter (PostgreSQL) uses `null` for unset list fields
 * on the OAuth models, and for several of them `null` means "no restriction"
 * (e.g. a resource's allowedScopes). Prisma list columns can't hold NULL, so
 * this extension, used only by Better Auth, stores `null` as an empty list and
 * reads an empty list back as `null`.
 */
const LIST_FIELDS = new Set([
  "scopes",
  "clientCredentialsScopes",
  "contacts",
  "redirectUris",
  "postLogoutRedirectUris",
  "grantTypes",
  "responseTypes",
  "allowedScopes",
  "resources",
  "requestedUserInfoClaims",
]);

function nullsToEmpty(data: unknown): void {
  if (!data || typeof data !== "object") return;
  if (Array.isArray(data)) return data.forEach(nullsToEmpty);
  for (const [key, value] of Object.entries(data)) {
    if (value === null && LIST_FIELDS.has(key)) (data as Record<string, unknown>)[key] = [];
  }
}

function emptyToNulls(result: unknown): void {
  if (!result || typeof result !== "object") return;
  if (Array.isArray(result)) return result.forEach(emptyToNulls);
  for (const [key, value] of Object.entries(result)) {
    if (LIST_FIELDS.has(key) && Array.isArray(value) && value.length === 0) {
      (result as Record<string, unknown>)[key] = null;
    }
  }
}

type WriteArgs = { data?: unknown; create?: unknown; update?: unknown };

export const authDb = db.$extends({
  name: "better-auth-null-lists",
  query: {
    $allModels: {
      async $allOperations({ model, args, query }) {
        if (!model.startsWith("Oauth")) return query(args);
        if (args && typeof args === "object") {
          const write = args as WriteArgs;
          nullsToEmpty(write.data);
          nullsToEmpty(write.create);
          nullsToEmpty(write.update);
        }
        const result = await query(args);
        emptyToNulls(result);
        return result;
      },
    },
  },
});
