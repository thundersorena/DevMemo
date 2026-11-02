import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { authDb } from "./auth-db";
import { env } from "./env";

const config = env();

/** The MCP endpoint is the OAuth protected resource; tokens are bound to it. */
export const MCP_RESOURCE = new URL("/api/mcp", config.BETTER_AUTH_URL).toString();

/**
 * Better Auth with GitHub as the only sign-in method.
 * No passwords, no email verification, no reset flow.
 */
export const auth = betterAuth({
  baseURL: config.BETTER_AUTH_URL,
  secret: config.BETTER_AUTH_SECRET,
  database: prismaAdapter(authDb, { provider: "postgresql" }),
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
  plugins: [
    // Signing keys + /jwks for MCP access tokens.
    jwt(),
    // OAuth 2.1 authorization server for MCP clients (Claude, ChatGPT, Cursor…).
    mcp({
      loginPage: "/login",
      consentPage: "/consent",
      resource: MCP_RESOURCE,
      scopes: ["openid", "profile", "email", "offline_access"],
      // CIMD (below) is the current MCP standard. Dynamic Client Registration
      // is kept for clients that don't support CIMD yet (e.g. Cursor, older
      // Claude Code). "infer" accepts their native/localhost redirect URIs.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: "infer",
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
    // Must be last: lets server actions set auth cookies.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
