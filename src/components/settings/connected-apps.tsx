"use client";

import { useState, useTransition } from "react";
import { revokeConnectedAppAction } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import type { ConnectedAppView } from "@/server/oauth-apps.service";

export function ConnectedApps({ apps, timeZone }: { apps: ConnectedAppView[]; timeZone: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium" });

  if (apps.length === 0) {
    return <p className="text-sm text-muted">No apps connected yet. Connect one with the guide above.</p>;
  }

  return (
    <div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {apps.map((app) => (
          <li key={app.clientId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
            {app.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={app.icon} alt="" className="size-6 rounded border border-border object-contain" />
            ) : (
              <span className="grid size-6 place-items-center rounded bg-surface-muted text-xs font-medium">
                {app.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="font-medium">{app.name}</span>
            <span className="text-xs text-muted">
              Connected {fmt.format(new Date(app.connectedAt))}
              {app.lastUsedAt ? ` · last sign-in ${fmt.format(new Date(app.lastUsedAt))}` : ""}
            </span>
            <Button
              size="sm"
              variant="danger"
              className="ml-auto"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Disconnect ${app.name}? It will have to ask for access again.`)) return;
                setError(null);
                startTransition(async () => {
                  const result = await revokeConnectedAppAction(app.clientId);
                  if (!result.ok) setError(result.error);
                });
              }}
            >
              Disconnect
            </Button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
