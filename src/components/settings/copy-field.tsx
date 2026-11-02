"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard unavailable (insecure context); user can select manually.
        }
      }}
      className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium transition hover:bg-surface-muted"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

/** Read-only value with a copy button. */
export function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted/50 py-1.5 pr-1.5 pl-3">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px]" title={value}>
          {value}
        </code>
        <CopyButton value={value} />
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Multi-line code snippet with a copy button. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div>
      {label && <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>}
      <div className="relative rounded-lg border border-border bg-surface-muted/50">
        <pre className="overflow-x-auto p-3 pr-20 font-mono text-[12.5px] leading-relaxed">{code}</pre>
        <div className="absolute top-2 right-2">
          <CopyButton value={code} />
        </div>
      </div>
    </div>
  );
}
