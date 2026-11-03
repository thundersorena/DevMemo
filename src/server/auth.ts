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

export const MCP_RESOURCE = new URL("/api/mcp", config.BETTER_AUTH_URL).toString();

export const auth = betterAuth({
  baseURL: config.BETTER_AUTH_URL,
  secret: config.BETTER_AUTH_SECRET,
  database: prismaAdapter(authDb, { provider: "postgresql" }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    github: {
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
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
    useSecureCookies: config.BETTER_AUTH_URL.startsWith("https://"),
  },
  plugins: [
    jwt(),
    mcp({
      loginPage: "/login",
      consentPage: "/consent",
      resource: MCP_RESOURCE,
      scopes: ["openid", "profile", "email", "offline_access"],
      // DCR for clients without CIMD support; "infer" allows localhost redirect URIs.
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
