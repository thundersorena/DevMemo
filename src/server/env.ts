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
  // A deployed app pointing auth at localhost sends GitHub a localhost
  // redirect_uri ("redirect_uri is not associated with this application").
  // Fail loudly instead.
  const authHost = new URL(parsed.data.BETTER_AUTH_URL).hostname;
  if (process.env.VERCEL === "1" && (authHost === "localhost" || authHost === "127.0.0.1")) {
    throw new Error(
      "Invalid environment configuration:\n  - BETTER_AUTH_URL points to localhost on a deployed app. " +
        "Set it to your public URL (e.g. https://devmemo.example.com) in your hosting provider's environment variables.",
    );
  }

  cached = parsed.data;
  return cached;
}
