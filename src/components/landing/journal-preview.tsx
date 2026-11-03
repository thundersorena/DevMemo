const commits = [
  ["a3f91c2", "Verify webhook HMAC with raw body", "10:42"],
  ["7be0d14", "Make commit ingestion idempotent", "11:18"],
  ["e52c8aa", "Convert commit time to user timezone", "15:06"],
];

export function JournalPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-x-8 -inset-y-10 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_40%,color-mix(in_oklab,var(--accent)_18%,transparent),transparent)]"
      />
      <figure
        aria-label="Example DevMemo journal entry"
        className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_-24px_rgb(0_0_0/0.25)]"
      >
        <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted/60 px-4 py-3">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="ml-3 font-mono text-xs text-muted">devmemo / journal / 2026-11-02</span>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-accent">Today</p>
              <p className="text-lg font-semibold tracking-tight">Monday, November 2</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-workday/40 bg-workday/10 px-2 py-1 text-xs font-medium text-workday">
              <span className="size-1.5 rounded-full bg-workday" /> Workday
            </span>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold tracking-wider text-muted uppercase">Notes</p>
            <ol className="space-y-3 border-l border-border pl-4">
              <li className="text-sm leading-relaxed">
                <span className="mr-2 font-mono text-xs text-muted">10:05</span>
                Webhooks returned 401 in staging. Investigating signature check.
              </li>
              <li className="text-sm leading-relaxed">
                <span className="mr-2 font-mono text-xs text-muted">12:40</span>
                <span className="mr-1.5 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">via AI</span>
                Root cause: body was parsed before HMAC verification. Decided to verify on the raw body.
              </li>
            </ol>
          </div>

          <div>
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
              Git activity <span className="font-mono normal-case tracking-normal">acme/api</span>
            </p>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {commits.map(([sha, message, time]) => (
                <li key={sha} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <code className="rounded bg-git/10 px-1.5 py-0.5 font-mono text-[11px] text-git">{sha}</code>
                  <span className="min-w-0 flex-1 truncate">{message}</span>
                  <span className="font-mono text-xs text-muted">{time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </figure>
    </div>
  );
}
