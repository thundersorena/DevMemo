"use client";

import { useState, useTransition } from "react";
import {
  createHookAction,
  deleteHookAction,
  revealHookSecretAction,
  rotateHookSecretAction,
} from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import type { HookView } from "@/server/github/github.service";
import { CopyField } from "./copy-field";

const STATUS_STYLE: Record<string, string> = {
  ok: "bg-workday/10 text-workday",
  ignored: "bg-surface-muted text-muted",
  error: "bg-danger/10 text-danger",
};

export function GitHubIntegration({ hook, timeZone }: { hook: HookView | null; timeZone: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string; secret?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong");
      else if (result.secret) setSecret(result.secret);
    });
  }

  if (!hook) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Create a personal webhook endpoint, then add it to any repository or organization on GitHub.
          Commits you push are imported automatically.
        </p>
        <Button variant="primary" disabled={pending} onClick={() => run(createHookAction)}>
          {pending ? "Creating…" : "Set up GitHub webhook"}
        </Button>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DeliveryStatus hook={hook} timeZone={timeZone} />

      <div className="grid gap-4">
        <CopyField label="Payload URL" value={hook.url} />
        {secret ? (
          <CopyField label="Secret" value={secret} hint="Use the same secret for every repository." />
        ) : (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Secret</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-border bg-surface-muted/50 px-3 py-2 font-mono text-[13px] text-muted">
                ••••••••••••••••••••••••
              </code>
              <Button size="sm" disabled={pending} onClick={() => run(revealHookSecretAction)}>
                Reveal
              </Button>
            </div>
          </div>
        )}
      </div>

      <details className="group rounded-lg border border-border px-4 py-3 text-sm open:pb-4">
        <summary className="cursor-pointer font-medium select-none">How to add it on GitHub</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
          <li>
            Open a repository (or organization) → <b className="text-foreground">Settings → Webhooks → Add webhook</b>.
          </li>
          <li>Paste the <b className="text-foreground">Payload URL</b> above.</li>
          <li>
            Content type: <code className="font-mono text-foreground">application/json</code>.
          </li>
          <li>Paste the <b className="text-foreground">Secret</b>.</li>
          <li>
            Choose <b className="text-foreground">Just the push event</b>, keep it active, and save.
          </li>
          <li>GitHub sends a ping right away. The status above turns green when it arrives.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">
          GitHub must be able to reach this URL. For local development, use a tunnel (for example
          {" "}<code className="font-mono">cloudflared</code> or <code className="font-mono">ngrok</code>) and set
          {" "}<code className="font-mono">BETTER_AUTH_URL</code> to the tunnel address.
        </p>
      </details>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Generate a new secret? Repositories using the old secret will stop delivering until you update them.")) {
              run(rotateHookSecretAction);
            }
          }}
        >
          Rotate secret
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Remove the webhook endpoint? Imported commits are kept.")) {
              setSecret(null);
              run(deleteHookAction);
            }
          }}
        >
          Remove
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function DeliveryStatus({ hook, timeZone }: { hook: HookView; timeZone: string }) {
  if (!hook.lastDeliveryAt) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-surface-muted/60 px-3 py-2 text-sm text-muted">
        <span className="size-2 rounded-full bg-muted" />
        Waiting for the first delivery from GitHub.
      </div>
    );
  }
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(hook.lastDeliveryAt));
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[hook.lastDeliveryStatus ?? ""] ?? STATUS_STYLE.ignored}`}>
        {hook.lastDeliveryStatus ?? "unknown"}
      </span>
      <span>{hook.lastDeliveryMessage}</span>
      <span className="text-muted">· {when}</span>
    </div>
  );
}
