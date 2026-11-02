"use client";

import { useState, useTransition } from "react";
import { setOnlyOwnCommitsAction } from "@/app/(dashboard)/actions";

export function OnlyOwnCommitsToggle({ value }: { value: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[var(--accent)]"
          defaultChecked={value}
          disabled={pending}
          onChange={(e) => {
            const next = e.currentTarget.checked;
            setError(null);
            startTransition(async () => {
              const result = await setOnlyOwnCommitsAction(next);
              if (!result.ok) setError(result.error);
            });
          }}
        />
        <span>
          <span className="font-medium">Only import my commits</span>
          <span className="block text-muted">
            Skip commits by other people in shared repositories. Matched by your GitHub username and email.
          </span>
        </span>
      </label>
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
