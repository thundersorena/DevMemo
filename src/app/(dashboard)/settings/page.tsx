import type { Metadata } from "next";
import { Suspense } from "react";
import { GitHubAppPanel } from "@/components/settings/github-app-panel";
import { GitHubIntegration } from "@/components/settings/github-integration";
import { OnlyOwnCommitsToggle } from "@/components/settings/only-own-commits";
import { AuthorEmailsForm } from "@/components/settings/author-emails";
import { ProviderWebhook } from "@/components/settings/provider-webhook";
import { listProviderHooks } from "@/server/git/provider-hooks.service";
import { McpTokens } from "@/components/settings/mcp-tokens";
import { McpClientGuides } from "@/components/settings/mcp-client-guides";
import { ConnectedApps } from "@/components/settings/connected-apps";
import { CopyField } from "@/components/settings/copy-field";
import { listConnectedApps } from "@/server/oauth-apps.service";
import { SettingsForm } from "@/components/settings/timezone-form";
import { listTokens } from "@/server/api-token.service";
import { env, githubApp } from "@/server/env";
import { BACKFILL_DAYS, installUrl, listInstallations } from "@/server/github/app.service";
import { getHook } from "@/server/github/github.service";
import { requireUser } from "@/server/session";
import { getImportPreferences } from "@/server/user.service";

export const metadata: Metadata = { title: "Settings" };

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card title="Preferences">
        <Suspense fallback={<Skeleton />}>
          <Preferences />
        </Suspense>
      </Card>

      <Card id="github" title="GitHub">
        <Suspense fallback={<Skeleton />}>
          <GitHubSection searchParams={searchParams} />
        </Suspense>
      </Card>

      <Card id="git-providers" title="GitLab & Bitbucket">
        <Suspense fallback={<Skeleton />}>
          <ProvidersSection />
        </Suspense>
      </Card>

      <Card id="export" title="Export">
        <ExportForm />
      </Card>

      <Card id="mcp" title="AI assistants (MCP)">
        <Suspense fallback={<Skeleton />}>
          <McpSection />
        </Suspense>
      </Card>
    </div>
  );
}

async function Preferences() {
  const user = await requireUser();
  const timezones = TIMEZONES.includes(user.timezone) ? TIMEZONES : [user.timezone, ...TIMEZONES];
  return <SettingsForm timezone={user.timezone} timezones={timezones} />;
}

async function GitHubSection({ searchParams }: Pick<PageProps<"/settings">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const app = githubApp();
  const [hook, installations, prefs] = await Promise.all([
    getHook(user.id),
    app ? listInstallations(user.id) : Promise.resolve([]),
    getImportPreferences(user.id),
  ]);

  const manual = <GitHubIntegration hook={hook} timeZone={user.timezone} />;

  return (
    <div className="space-y-6">
      {params.github === "connected" && (
        <p className="rounded-lg bg-workday/10 px-3 py-2 text-sm text-workday">
          GitHub connected. Importing history in the background.
        </p>
      )}
      {params.github === "error" && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {typeof params.reason === "string" ? params.reason : "Could not connect GitHub."}
        </p>
      )}

      {app ? (
        <GitHubAppPanel installations={installations} installUrl={installUrl()} backfillDays={BACKFILL_DAYS} />
      ) : null}

      <div className="space-y-5 border-t border-border pt-5">
        <OnlyOwnCommitsToggle value={prefs.onlyOwnCommits} />
        <AuthorEmailsForm emails={prefs.authorEmails} accountEmail={prefs.accountEmail} />
      </div>

      {app ? (
        <details className="group rounded-lg border border-border px-4 py-3 open:pb-4" open={Boolean(hook)}>
          <summary className="cursor-pointer text-sm font-medium select-none">
            Advanced: manual webhook
            <span className="ml-2 font-normal text-muted">for repositories you can&apos;t install the App on</span>
          </summary>
          <div className="mt-4">{manual}</div>
        </details>
      ) : (
        manual
      )}
    </div>
  );
}

async function ProvidersSection() {
  const user = await requireUser();
  const hooks = await listProviderHooks(user.id);
  return (
    <div className="divide-y divide-border">
      {(["gitlab", "bitbucket"] as const).map((provider) => (
        <div key={provider} className="py-5 first:pt-0 last:pb-0">
          <h3 className="mb-3 text-sm font-semibold">{provider === "gitlab" ? "GitLab" : "Bitbucket"}</h3>
          <ProviderWebhook provider={provider} hook={hooks[provider]} timeZone={user.timezone} />
        </div>
      ))}
    </div>
  );
}

async function McpSection() {
  const user = await requireUser();
  const [tokens, apps] = await Promise.all([listTokens(user.id), listConnectedApps(user.id)]);
  const mcpUrl = new URL("/api/mcp", env().BETTER_AUTH_URL).toString();
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Connect any MCP-compatible AI tool to your journal. Add the URL below; the tool opens DevMemo so you can
          sign in and approve access. No tokens to copy.
        </p>
        <CopyField label="MCP server URL" value={mcpUrl} />
        <McpClientGuides mcpUrl={mcpUrl} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Connected apps</h3>
        <ConnectedApps apps={apps} timeZone={user.timezone} />
      </div>

      <details className="rounded-lg border border-border px-4 py-3 open:pb-4" open={tokens.length > 0}>
        <summary className="cursor-pointer text-sm font-medium select-none">Personal access tokens</summary>
        <div className="mt-4">
          <McpTokens tokens={tokens} mcpUrl={mcpUrl} timeZone={user.timezone} />
        </div>
      </details>
    </div>
  );
}

function Card({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Skeleton() {
  return <div className="h-24 animate-pulse rounded-lg bg-surface-muted" />;
}

function ExportForm() {
  return (
    <form action="/api/export" method="get" className="space-y-3">
      <p className="text-sm text-muted">
        Download your journal: notes, commits and summaries. Leave the dates empty to export everything.
      </p>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">From</span>
          <input type="date" name="from" className="h-9 rounded-lg border border-border bg-surface px-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">To</span>
          <input type="date" name="to" className="h-9 rounded-lg border border-border bg-surface px-2" />
        </label>
        <div className="flex gap-1.5">
          {[
            ["md", "Markdown"],
            ["json", "JSON"],
            ["csv", "CSV"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="submit"
              name="format"
              value={value}
              className="h-9 rounded-lg border border-border bg-surface px-3 font-medium transition hover:bg-surface-muted"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}

