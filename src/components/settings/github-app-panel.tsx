"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { reimportHistoryAction, unlinkInstallationAction } from "@/app/(dashboard)/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { ExternalIcon, GitHubIcon } from "@/components/ui/icons";
import type { InstallationView } from "@/server/github/app.service";

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "queued", className: "bg-surface-muted text-muted" },
  running: { label: "importing…", className: "bg-accent/10 text-accent" },
  done: { label: "imported", className: "bg-workday/10 text-workday" },
  error: { label: "failed", className: "bg-danger/10 text-danger" },
};

export function GitHubAppPanel({
  installations,
  installUrl,
  backfillDays,
}: {
  installations: InstallationView[];
  installUrl: string;
  backfillDays: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const importing = installations.some((i) =>
    i.repositories.some((r) => r.backfillStatus === "pending" || r.backfillStatus === "running"),
  );
  useEffect(() => {
    if (!importing) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [importing, router]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong");
    });
  }

  if (installations.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Install the DevMemo GitHub App and choose which repositories to connect. Every push is imported
          automatically, along with the last {backfillDays} days of history. No webhooks or secrets to copy.
        </p>
        <a href={installUrl} className={buttonClass("primary")}>
          <GitHubIcon className="size-4" />
          Connect GitHub repositories
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {installations.map((inst) => (
        <div key={inst.id} className="rounded-xl border border-border">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
            <GitHubIcon className="size-4" />
            <span className="font-medium">{inst.accountLogin}</span>
            <span className="text-xs text-muted">
              {inst.accountType === "Organization" ? "organization" : "personal"} ·{" "}
              {inst.repositorySelection === "all" ? "all repositories" : `${inst.repositories.length} selected`}
            </span>
            {inst.suspended && (
              <span className="rounded-md bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">suspended</span>
            )}
            <span className="ml-auto flex gap-1">
              <a href={inst.configureUrl} target="_blank" rel="noreferrer" className={buttonClass("ghost", "", "sm")}>
                Configure <ExternalIcon className="size-3" />
              </a>
              <Button
                size="sm"
                variant="danger"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Disconnect ${inst.accountLogin} from DevMemo? Imported commits are kept. To uninstall the App completely, use "Configure" on GitHub.`)) {
                    run(() => unlinkInstallationAction(inst.id));
                  }
                }}
              >
                Disconnect
              </Button>
            </span>
          </div>
          {inst.repositories.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No repositories selected.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto">
              {inst.repositories.map((repo) => {
                const status = STATUS[repo.backfillStatus] ?? STATUS.pending;
                return (
                  <li key={repo.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                    <span className="font-mono text-[13px]">{repo.fullName}</span>
                    {repo.private && <span className="text-xs text-muted">private</span>}
                    <span className={`ml-auto rounded-md px-2 py-0.5 text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                    {repo.backfillMessage && (
                      <span className="w-full text-xs text-muted">{repo.backfillMessage}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <a href={installUrl} className={buttonClass("secondary", "", "sm")}>
          <GitHubIcon className="size-3.5" />
          Add account or organization
        </a>
        <Button size="sm" variant="ghost" disabled={pending || importing} onClick={() => run(reimportHistoryAction)}>
          {importing ? "Importing history…" : `Re-import last ${backfillDays} days`}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
