import { after, NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/auth";
import { backfillRepositories, linkInstallationsFromCode } from "@/server/github/app.service";
import { AppError } from "@/server/errors";
import { GitHubApiError } from "@/server/github/app";

// History import runs after the redirect, within this function's lifetime.
export const maxDuration = 60;

/**
 * GET /api/github/app/callback?code=…&installation_id=…&setup_action=install|update
 * GitHub sends the user here after installing or reconfiguring the App.
 */
export async function GET(req: NextRequest) {
  const settings = (params: Record<string, string>) => {
    const url = new URL("/settings", req.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.hash = "github";
    return NextResponse.redirect(url);
  };

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    const login = new URL("/login", req.url);
    return NextResponse.redirect(login);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    // The App must have "Request user authorization (OAuth) during installation" enabled.
    return settings({ github: "error", reason: "GitHub didn't return an authorization code. Try connecting again." });
  }

  try {
    const repoIds = await linkInstallationsFromCode(session.user.id, code);
    if (repoIds.length) after(() => backfillRepositories(repoIds));
    return settings({ github: "connected" });
  } catch (error) {
    if (!(error instanceof AppError) && !(error instanceof GitHubApiError)) {
      console.error("[github-app] callback failed", error);
    }
    const reason =
      error instanceof AppError || error instanceof GitHubApiError
        ? error.message
        : "Something went wrong while connecting GitHub.";
    return settings({ github: "error", reason: reason.slice(0, 300) });
  }
}
