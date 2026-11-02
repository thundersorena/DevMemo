import type { Metadata } from "next";
import { Suspense } from "react";
import { GitHubIntegration } from "@/components/settings/github-integration";
import { McpTokens } from "@/components/settings/mcp-tokens";
import { SettingsForm } from "@/components/settings/timezone-form";
import { listTokens } from "@/server/api-token.service";
import { env } from "@/server/env";
import { getHook } from "@/server/github/github.service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Settings" };

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card title="Preferences">
        <Suspense fallback={<Skeleton />}>
          <Preferences />
        </Suspense>
      </Card>

      <Card id="github" title="GitHub activity">
        <Suspense fallback={<Skeleton />}>
          <GitHubSection />
        </Suspense>
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

async function GitHubSection() {
  const user = await requireUser();
  const hook = await getHook(user.id);
  return <GitHubIntegration hook={hook} timeZone={user.timezone} />;
}

async function McpSection() {
  const user = await requireUser();
  const tokens = await listTokens(user.id);
  const mcpUrl = new URL("/api/mcp", env().BETTER_AUTH_URL).toString();
  return <McpTokens tokens={tokens} mcpUrl={mcpUrl} timeZone={user.timezone} />;
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
