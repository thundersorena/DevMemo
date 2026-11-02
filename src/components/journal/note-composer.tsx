"use client";

import { useActionState, useEffect, useRef } from "react";
import { addNoteAction, type ActionResult } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { NOTE_MAX_LENGTH } from "@/lib/validation";

export function NoteComposer({ date }: { date: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addNoteAction.bind(null, date),
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-surface focus-within:border-accent/60"
    >
      <label htmlFor="note-content" className="sr-only">
        New note
      </label>
      <textarea
        id="note-content"
        name="content"
        required
        rows={3}
        maxLength={NOTE_MAX_LENGTH}
        placeholder="What did you work on, investigate or decide?"
        className="block w-full resize-y rounded-t-xl bg-transparent px-4 py-3 text-[15px] leading-relaxed outline-none placeholder:text-muted"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
        <span className="text-xs text-muted">
          {state && !state.ok ? (
            <span role="alert" className="text-danger">{state.error}</span>
          ) : (
            <>
              <kbd className="font-mono">Ctrl</kbd> + <kbd className="font-mono">Enter</kbd> to save
            </>
          )}
        </span>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
