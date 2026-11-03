import "server-only";
import { createSign } from "node:crypto";
import { githubApp, type GitHubAppConfig } from "../env";
import { BadRequestError } from "../errors";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export function requireApp(): GitHubAppConfig {
  const app = githubApp();
  if (!app) throw new BadRequestError("The GitHub App is not configured on this server");
  return app;
}

/** RS256 JWT identifying the App (valid ~9 minutes). */
export function createAppJwt(app: Pick<GitHubAppConfig, "appId" | "privateKey">, now = Date.now()): string {
  const iat = Math.floor(now / 1000) - 60; // allow for clock drift
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat, exp: iat + 600, iss: app.appId })).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(app.privateKey, "base64url")}`;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** Installation access token (1 hour), cached until 5 minutes before expiry. */
export async function installationToken(installationId: string): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.token;

  const app = requireApp();
  const data = await github<{ token: string; expires_at: string }>(
    `/app/installations/${installationId}/access_tokens`,
    { method: "POST", token: createAppJwt(app), tokenType: "Bearer" },
  );
  tokenCache.set(installationId, { token: data.token, expiresAt: Date.parse(data.expires_at) });
  return data.token;
}

type RequestOptions = {
  method?: string;
  token: string;
  tokenType?: "Bearer" | "token";
  body?: unknown;
};

export async function github<T>(path: string, options: RequestOptions): Promise<T> {
  const { data } = await githubWithHeaders<T>(path, options);
  return data;
}

async function githubWithHeaders<T>(
  path: string,
  { method = "GET", token, tokenType = "Bearer", body }: RequestOptions,
): Promise<{ data: T; headers: Headers }> {
  const app = requireApp();
  const url = path.startsWith("http") ? path : `${app.apiUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `${tokenType} ${token}`,
      "User-Agent": "DevMemo",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `GitHub API ${method} ${path} failed with ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message += `: ${parsed.message}`;
    } catch {
      // non-JSON error body
    }
    throw new GitHubApiError(message, res.status);
  }
  return { data: (await res.json()) as T, headers: res.headers };
}

export async function githubPaginate<T, R = T[]>(
  path: string,
  options: RequestOptions & { maxPages?: number; pick?: (page: R) => T[] },
): Promise<{ items: T[]; truncated: boolean }> {
  const { maxPages = 10, pick, ...request } = options;
  const items: T[] = [];
  let next: string | null = path;
  let pages = 0;
  while (next && pages < maxPages) {
    const { data, headers }: { data: R; headers: Headers } = await githubWithHeaders<R>(next, request);
    items.push(...(pick ? pick(data) : (data as unknown as T[])));
    pages++;
    next = /<([^>]+)>;\s*rel="next"/.exec(headers.get("link") ?? "")?.[1] ?? null;
  }
  return { items, truncated: Boolean(next) };
}

export async function exchangeUserCode(code: string): Promise<string> {
  const app = requireApp();
  const res = await fetch(`${app.webUrl}/login/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "DevMemo" },
    body: JSON.stringify({ client_id: app.clientId, client_secret: app.clientSecret, code }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new GitHubApiError(data.error_description ?? "Could not exchange the GitHub authorization code", 400);
  }
  return data.access_token;
}

export type ApiInstallation = {
  id: number;
  account: { login: string; id: number; type: string } | null;
  repository_selection: "all" | "selected";
  suspended_at: string | null;
};

export type ApiRepository = {
  id: number;
  full_name: string;
  private: boolean;
  default_branch?: string;
};

export type ApiCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name?: string | null; email?: string | null; date?: string | null } | null;
  };
  author: { login: string } | null;
};
