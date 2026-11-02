"use client";

import { useState } from "react";
import { CodeBlock } from "./copy-field";

type Guide = { id: string; label: string; steps: React.ReactNode[]; code?: { label: string; value: string } };

function guides(url: string): Guide[] {
  return [
    {
      id: "claude",
      label: "Claude",
      steps: [
        <>On claude.ai or the Claude app, open <b>Settings → Connectors → Add custom connector</b>.</>,
        <>Name it <b>DevMemo</b> and paste the MCP server URL.</>,
        <>Click <b>Connect</b>, sign in with GitHub and choose <b>Allow access</b>.</>,
      ],
    },
    {
      id: "claude-code",
      label: "Claude Code",
      code: { label: "Terminal (one line, any shell)", value: `claude mcp add --scope user --transport http devmemo ${url}` },
      steps: [
        <>Run the command below once.</>,
        <>In Claude Code, run <code>/mcp</code>, pick <b>devmemo</b> and choose <b>Authenticate</b>. Your browser opens to sign in and allow access.</>,
      ],
    },
    {
      id: "chatgpt",
      label: "ChatGPT",
      steps: [
        <>Open <b>Settings → Apps &amp; Connectors</b>. Under <b>Advanced</b>, turn on <b>Developer mode</b> if your plan requires it.</>,
        <>Choose <b>Create</b>, name it DevMemo, paste the MCP server URL and pick <b>OAuth</b> authentication.</>,
        <>Sign in with GitHub and allow access when ChatGPT opens DevMemo.</>,
      ],
    },
    {
      id: "cursor",
      label: "Cursor",
      code: { label: "~/.cursor/mcp.json", value: JSON.stringify({ mcpServers: { devmemo: { url } } }, null, 2) },
      steps: [
        <>Add DevMemo to your MCP config.</>,
        <>In <b>Cursor Settings → MCP</b>, DevMemo shows <b>Needs login</b>. Click it to sign in and allow access.</>,
      ],
    },
    {
      id: "vscode",
      label: "VS Code",
      code: { label: ".vscode/mcp.json (or your user MCP configuration)", value: JSON.stringify({ servers: { devmemo: { type: "http", url } } }, null, 2) },
      steps: [<>Add the server, click <b>Start</b> above it, and approve the sign-in prompt.</>],
    },
    {
      id: "windsurf",
      label: "Windsurf",
      code: { label: "~/.codeium/windsurf/mcp_config.json", value: JSON.stringify({ mcpServers: { devmemo: { serverUrl: url } } }, null, 2) },
      steps: [<>Add the server and refresh MCP servers in Windsurf. Sign in when asked.</>],
    },
    {
      id: "gemini",
      label: "Gemini CLI",
      code: { label: "~/.gemini/settings.json", value: JSON.stringify({ mcpServers: { devmemo: { httpUrl: url } } }, null, 2) },
      steps: [<>Add the server, start Gemini CLI and run <code>/mcp auth devmemo</code> to sign in.</>],
    },
    {
      id: "codex",
      label: "Codex CLI",
      code: { label: "~/.codex/config.toml", value: `[mcp_servers.devmemo]\nurl = "${url}"` },
      steps: [<>Add the server, then run <code>codex mcp login devmemo</code> to sign in.</>],
    },
    {
      id: "other",
      label: "Other",
      code: { label: "Clients that only support local (stdio) servers", value: `npx -y mcp-remote ${url}` },
      steps: [
        <>Any MCP client that supports remote servers and OAuth: just add the MCP server URL. Sign-in is discovered automatically.</>,
        <>Clients without OAuth: create a personal access token below and send it as <code>Authorization: Bearer dm_…</code>.</>,
        <>Clients that only run local commands: use <code>mcp-remote</code> as a bridge; it handles sign-in in your browser.</>,
      ],
    },
  ];
}

export function McpClientGuides({ mcpUrl }: { mcpUrl: string }) {
  const list = guides(mcpUrl);
  const [active, setActive] = useState(list[0].id);
  const guide = list.find((g) => g.id === active) ?? list[0];

  return (
    <div>
      <div role="tablist" aria-label="AI clients" className="-mx-1 mb-4 flex flex-wrap gap-1">
        {list.map((g) => (
          <button
            key={g.id}
            role="tab"
            type="button"
            aria-selected={g.id === active}
            onClick={() => setActive(g.id)}
            className={`rounded-md px-2.5 py-1 text-sm transition ${
              g.id === active ? "bg-foreground text-background" : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="space-y-3">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm [&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px]">
          {guide.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        {guide.code && <CodeBlock label={guide.code.label} code={guide.code.value} />}
      </div>
    </div>
  );
}
