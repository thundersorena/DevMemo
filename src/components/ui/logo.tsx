export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-lg bg-foreground font-mono text-xs text-background"
      >
        dm
      </span>
      <span className={compact ? "hidden sm:inline" : ""}>DevMemo</span>
    </span>
  );
}
