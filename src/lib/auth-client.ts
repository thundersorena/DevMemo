"use client";

import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

// oauthProviderClient carries the signed OAuth request through sign-in, so an
// MCP client's authorization continues after the user logs in with GitHub.
export const authClient = createAuthClient({ plugins: [oauthProviderClient()] });
