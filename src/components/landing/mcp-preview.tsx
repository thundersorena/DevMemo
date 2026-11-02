/** Decorative example of an AI assistant answering from the journal via MCP. */
export function McpPreview() {
  return (
    <figure
      aria-label="Example conversation with an AI assistant connected to DevMemo"
      className="overflow-hidden rounded-2xl border border-border bg-surface font-mono text-[13px] leading-relaxed shadow-[0_24px_60px_-28px_rgb(0_0_0/0.25)]"
    >
      <div className="border-b border-border bg-surface-muted/60 px-4 py-2.5 text-xs text-muted">claude · devmemo connected</div>
      <div className="space-y-4 p-4 break-words sm:p-5">
        <p>
          <span className="text-accent">you ›</span> When did I last investigate webhook authentication?
        </p>
        <div className="space-y-1 text-muted">
          <p>
            <span className="text-git">⚙ search_journal</span> {`{ query: "webhook authentication" }`}
          </p>
          <p>
            <span className="text-git">⚙ get_day</span> {`{ date: "2026-11-02" }`}
          </p>
        </div>
        <p className="font-sans text-sm leading-relaxed">
          On <strong>Monday, Nov 2</strong>. Staging webhooks returned 401 because the payload was parsed before
          the HMAC check. You decided to verify against the raw body and shipped it in{" "}
          <code className="rounded bg-git/10 px-1 text-git">a3f91c2</code> on <span className="font-mono">acme/api</span>.
        </p>
        <p>
          <span className="text-accent">you ›</span> Add a note: follow up on retry handling tomorrow.
        </p>
        <p className="text-muted">
          <span className="text-git">⚙ add_note</span> → <span className="text-workday">saved to 2026-11-02</span>
        </p>
      </div>
    </figure>
  );
}
