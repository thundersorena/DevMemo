"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setWorkDayAction } from "@/app/(dashboard)/actions";
import { CheckIcon } from "@/components/ui/icons";

export function WorkdayToggle({ date, isWorkDay }: { date: string; isWorkDay: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(isWorkDay);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !optimistic;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await setWorkDayAction(date, next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        onClick={toggle}
        disabled={pending}
        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
          optimistic
            ? "border-workday/40 bg-workday/10 text-workday"
            : "border-border bg-surface text-muted hover:text-foreground"
        }`}
      >
        <span
          className={`grid size-4 place-items-center rounded border transition ${
            optimistic ? "border-workday bg-workday text-surface" : "border-border"
          }`}
        >
          {optimistic && <CheckIcon className="size-3" strokeWidth={3} />}
        </span>
        Workday
      </button>
      {error && <span role="alert" className="text-sm text-danger">{error}</span>}
    </div>
  );
}
