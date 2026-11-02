"use client";

import { useActionState, useState, useTransition } from "react";
import { createTokenAction, revokeTokenAction, type SecretResult } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import type { ApiTokenView } from "@/server/api-token.service";
import { CodeBlock, CopyField } from "./copy-field";

export function McpTokens({
  tokens,
  mcpUrl,
  timeZone,
}: {
  tokens: ApiTokenView[];
  mcpUrl: string;
  timeZone: string;
}) {
  const [state, formAction, creating] = useActionState<SecretResult | null, FormData>(createTokenAction, null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const newToken = state?.ok ? state.secret : null;
  const shownToken = newToken ?? "<YOUR_TOKEN>";
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Connect Claude or any MCP client to your journal. Each client authenticates with a personal access
        token. The same token also works for the REST API.
      </p>

      <CopyField label="MCP server URL" value={mcpUrl} />

      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label htmlFor="token-name" className="mb-1.5 block text-xs font-medium text-muted">
            New token name
          </label>
          <input
            id="token-name"
            name="name"
            required
            maxLength={60}
            placeholder="e.g. Claude Code on laptop"
            className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-muted focus:border-accent/60"
          />
        </div>
        <Button type="submit" variant="primary" disabled={creating}>
          {creating ? "Creating…" : "Create token"}
        </Button>
      </form>
      {state && !state.ok && <p role="alert" className="text-sm text-danger">{state.error}</p>}

      {newToken && (
        <div className="space-y-3 rounded-xl border border-workday/40 bg-workday/5 p-4">
          <p className="text-sm font-medium">Copy your token now. It won’t be shown again.</p>
          <CopyField label="Token" value={newToken} />
        </div>
      )}

      <div className="space-y-4">
        <CodeBlock
          label="Claude Code"
          code={`claude mcp add --transport http devmemo ${mcpUrl} \\\n  --header "Authorization: Bearer ${shownToken}"`}
        />
        <CodeBlock
          label="Claude Desktop (claude_desktop_config.json)"
          code={JSON.stringify(
            {
              mcpServers: {
                devmemo: {
                  command: "npx",
                  args: ["-y", "mcp-remote", mcpUrl, "--header", "Authorization:${DEVMEMO_AUTH}"],
                  env: { DEVMEMO_AUTH: `Bearer ${shownToken}` },
                },
              },
            },
            null,
            2,
          )}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted">Active tokens</p>
        {tokens.length === 0 ? (
          <p className="text-sm text-muted">No tokens yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {tokens.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                <span className="font-medium">{t.name}</span>
                <code className="font-mono text-xs text-muted">{t.prefix}…</code>
                <span className="text-xs text-muted">
                  Created {fmt.format(new Date(t.createdAt))} ·{" "}
                  {t.lastUsedAt ? `last used ${fmt.format(new Date(t.lastUsedAt))}` : "never used"}
                </span>
                <Button
                  size="sm"
                  variant="danger"
                  className="ml-auto"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Revoke "${t.name}"? Clients using it will lose access.`)) return;
                    setError(null);
                    startTransition(async () => {
                      const result = await revokeTokenAction(t.id);
                      if (!result.ok) setError(result.error);
                    });
                  }}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
