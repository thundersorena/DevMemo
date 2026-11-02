import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { env } from "./env";

const config = env();

/**
 * Better Auth with GitHub as the only sign-in method.
 * No passwords, no email verification, no reset flow.
 */
export const auth = betterAuth({
  baseURL: config.BETTER_AUTH_URL,
  secret: config.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    github: {
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
      scope: ["read:user", "user:email"],
      // Keep name, avatar and username in sync with GitHub on every sign-in.
      overrideUserInfoOnSignIn: true,
      mapProfileToUser: (profile) => ({ githubLogin: profile.login }),
    },
  },
  user: {
    additionalFields: {
      timezone: { type: "string", required: false, input: false },
      githubLogin: { type: "string", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once a day
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    // Secure (__Secure-) cookies whenever the app is served over HTTPS.
    useSecureCookies: config.BETTER_AUTH_URL.startsWith("https://"),
  },
  // Must be last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
