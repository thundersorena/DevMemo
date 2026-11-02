"use client";

import { useState, useTransition } from "react";
import {
  createProviderHookAction,
  deleteProviderHookAction,
  revealProviderSecretAction,
  rotateProviderSecretAction,
} from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import type { ProviderHookView } from "@/server/git/provider-hooks.service";
import type { Provider } from "@/server/git/providers";
import { CopyField } from "./copy-field";

const META: Record<Provider, { name: string; secretLabel: string; steps: React.ReactNode; note: string }> = {
  gitlab: {
    name: "GitLab",
    secretLabel: "Secret token",
    steps: (
      <>
        <li>
          Open a project (or group) → <b className="text-foreground">Settings → Webhooks → Add new webhook</b>.
        </li>
        <li>Paste the <b className="text-foreground">URL</b> and the <b className="text-foreground">Secret token</b>.</li>
        <li>
          Trigger: <b className="text-foreground">Push events</b> (all branches). Keep SSL verification on.
        </li>
        <li>Save, then use <b className="text-foreground">Test → Push events</b> to check the connection.</li>
      </>
    ),
    note: "GitLab sends at most the 20 most recent commits of a push.",
  },
  bitbucket: {
    name: "Bitbucket",
    secretLabel: "Secret",
    steps: (
      <>
        <li>
          Open a repository → <b className="text-foreground">Repository settings → Webhooks → Add webhook</b>.
        </li>
        <li>Title: DevMemo. Paste the <b className="text-foreground">URL</b>.</li>
        <li>
          Under <b className="text-foreground">Secret</b>, paste the secret (Bitbucket then signs every delivery).
        </li>
        <li>
          Triggers: <b className="text-foreground">Repository push</b>. Save.
        </li>
      </>
    ),
    note: "Bitbucket includes only a few recent commits per pushed branch in the webhook.",
  },
};

const STATUS_STYLE: Record<string, string> = {
  ok: "bg-workday/10 text-workday",
  ignored: "bg-surface-muted text-muted",
  error: "bg-danger/10 text-danger",
};

export function ProviderWebhook({
  provider,
  hook,
  timeZone,
}: {
  provider: Provider;
  hook: ProviderHookView | undefined;
  timeZone: string;
}) {
  const meta = META[provider];
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Import commits from {meta.name} with a webhook.</p>
        <Button size="sm" disabled={pending} onClick={() => run(() => createProviderHookAction(provider))}>
          {pending ? "Creating…" : `Set up ${meta.name} webhook`}
        </Button>
        {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
      </div>
    );
  }

  const when = hook.lastDeliveryAt
    ? new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(
        new Date(hook.lastDeliveryAt),
      )
    : null;

  return (
    <div className="space-y-4">
      {hook.lastDeliveryAt ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[hook.lastDeliveryStatus ?? ""] ?? STATUS_STYLE.ignored}`}>
            {hook.lastDeliveryStatus}
          </span>
          <span>{hook.lastDeliveryMessage}</span>
          <span className="text-muted">· {when}</span>
        </div>
      ) : (
        <p className="text-sm text-muted">Waiting for the first delivery from {meta.name}.</p>
      )}

      <CopyField label="URL" value={hook.url} />
      {secret ? (
        <CopyField label={meta.secretLabel} value={secret} />
      ) : (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">{meta.secretLabel}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-surface-muted/50 px-3 py-2 font-mono text-[13px] text-muted">
              ••••••••••••••••••••••••
            </code>
            <Button size="sm" disabled={pending} onClick={() => run(() => revealProviderSecretAction(provider))}>
              Reveal
            </Button>
          </div>
        </div>
      )}

      <details className="rounded-lg border border-border px-4 py-3 text-sm open:pb-4">
        <summary className="cursor-pointer font-medium select-none">How to add it on {meta.name}</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">{meta.steps}</ol>
        <p className="mt-3 text-xs text-muted">{meta.note} Add your {meta.name} commit email above so your commits are recognized.</p>
      </details>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Generate a new secret? ${meta.name} webhooks using the old one will stop working until updated.`)) {
              run(() => rotateProviderSecretAction(provider));
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
            if (window.confirm(`Remove the ${meta.name} webhook? Imported commits are kept.`)) {
              setSecret(null);
              run(() => deleteProviderHookAction(provider));
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
