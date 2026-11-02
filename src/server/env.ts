import "server-only";
import { z } from "zod";
import { isValidTimeZone } from "@/lib/dates";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  APP_TIMEZONE: z
    .string()
    .default("UTC")
    .refine(isValidTimeZone, "APP_TIMEZONE must be a valid IANA timezone"),
});

type Env = z.infer<typeof schema>;

/**
 * `next build` imports server modules to collect route config, but never
 * handles a request. Secrets are not needed (and often not available, e.g.
 * in a Docker build), so placeholders are used during the build phase only.
 * Real values are validated when the server starts handling requests.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const BUILD_PLACEHOLDERS: Env = {
  DATABASE_URL: "postgresql://build:build@localhost:5432/build",
  BETTER_AUTH_SECRET: "build-phase-placeholder-secret-not-used-at-runtime",
  BETTER_AUTH_URL: "http://localhost:3000",
  GITHUB_CLIENT_ID: "build-placeholder",
  GITHUB_CLIENT_SECRET: "build-placeholder",
  APP_TIMEZONE: "UTC",
};

let cached: Env | undefined;

/** Validated server environment. Throws a readable error on misconfiguration. */
export function env(): Env {
  if (cached) return cached;

  if (isBuildPhase) {
    const parsed = schema.safeParse(process.env);
    return parsed.success ? parsed.data : BUILD_PLACEHOLDERS;
  }

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

// ─── Optional: GitHub App ──────────────────────────────────────────────────

const GITHUB_APP_KEYS = [
  "GITHUB_APP_ID",
  "GITHUB_APP_SLUG",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_WEBHOOK_SECRET",
  "GITHUB_APP_PRIVATE_KEY",
] as const;

export type GitHubAppConfig = {
  appId: string;
  slug: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  privateKey: string;
  /** Overridable for tests / GitHub Enterprise. */
  apiUrl: string;
  webUrl: string;
};

/**
 * Accepts the PEM as-is, with escaped "\n" (how most dashboards store
 * multi-line values), or base64-encoded.
 */
function normalizePrivateKey(raw: string): string {
  const value = raw.trim().replace(/^"|"$/g, "");
  if (value.includes("-----BEGIN")) return value.replace(/\\n/g, "\n");
  const decoded = Buffer.from(value, "base64").toString("utf8");
  if (decoded.includes("-----BEGIN")) return decoded;
  throw new Error("GITHUB_APP_PRIVATE_KEY is not a PEM private key (raw, \\n-escaped or base64)");
}

let appCached: GitHubAppConfig | null | undefined;

/**
 * GitHub App configuration, or null when the App isn't configured (the
 * manual webhook still works). Partial configuration is an error.
 */
export function githubApp(): GitHubAppConfig | null {
  if (appCached !== undefined) return appCached;
  const present = GITHUB_APP_KEYS.filter((k) => process.env[k]?.trim());
  if (present.length === 0) {
    appCached = null;
    return null;
  }
  if (present.length !== GITHUB_APP_KEYS.length && !isBuildPhase) {
    const missing = GITHUB_APP_KEYS.filter((k) => !present.includes(k));
    throw new Error(
      `Invalid environment configuration:\n  - GitHub App is partially configured. Missing: ${missing.join(", ")}`,
    );
  }
  if (isBuildPhase && present.length !== GITHUB_APP_KEYS.length) return null;

  appCached = {
    appId: process.env.GITHUB_APP_ID!.trim(),
    slug: process.env.GITHUB_APP_SLUG!.trim(),
    clientId: process.env.GITHUB_APP_CLIENT_ID!.trim(),
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!.trim(),
    webhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET!.trim(),
    privateKey: normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY!),
    apiUrl: (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, ""),
    webUrl: (process.env.GITHUB_WEB_URL || "https://github.com").replace(/\/$/, ""),
  };
  return appCached;
}
