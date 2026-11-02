"use client";

import { useActionState } from "react";
import { updateSettingsAction, type ActionResult } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";

export function SettingsForm({ timezone, timezones }: { timezone: string; timezones: string[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateSettingsAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="timezone" className="block text-sm font-medium">
        Timezone
      </label>
      <p className="text-sm text-muted">
        Used to decide which calendar day a commit belongs to, and to show times.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="timezone"
          name="timezone"
          defaultValue={timezone}
          className="h-9 min-w-64 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent/60"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state?.ok && <span className="text-sm text-workday">Saved</span>}
        {state && !state.ok && <span role="alert" className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
