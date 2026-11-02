import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Settings" };

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card title="Preferences">
        <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-surface-muted" />}>
          <Preferences />
        </Suspense>
      </Card>

      <Card title="Integrations">
        <ul className="divide-y divide-border">
          <Integration
            name="GitHub activity"
            description="Import commits automatically when you push."
            status="Coming in phase 2"
          />
          <Integration
            name="MCP (Claude and other AI assistants)"
            description="Let your AI assistant read and update your journal."
            status="Coming in phase 3"
          />
        </ul>
      </Card>
    </div>
  );
}

async function Preferences() {
  const user = await requireUser();
  const timezones = TIMEZONES.includes(user.timezone) ? TIMEZONES : [user.timezone, ...TIMEZONES];
  return <SettingsForm timezone={user.timezone} timezones={timezones} />;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Integration({ name, description, status }: { name: string; description: string; status: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs text-muted">{status}</span>
    </li>
  );
}
