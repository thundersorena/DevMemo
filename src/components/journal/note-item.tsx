"use client";

import { useState, useTransition } from "react";
import { deleteNoteAction, updateNoteAction } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import type { NoteView } from "@/server/journal.service";
import { NOTE_MAX_LENGTH } from "@/lib/validation";

const SOURCE_LABEL: Record<NoteView["source"], string | null> = {
  MANUAL: null,
  MCP: "via AI",
  TELEGRAM: "via Telegram",
};

export function NoteItem({ date, note, time }: { date: string; note: NoteView; time: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sourceLabel = SOURCE_LABEL[note.source];

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateNoteAction(date, note.id, draft);
      if (result.ok) setEditing(false);
      else setError(result.error);
    });
  }

  function remove() {
    if (!window.confirm("Delete this note?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteNoteAction(date, note.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li className={`group relative pl-6 ${pending ? "opacity-60" : ""}`}>
      <span aria-hidden className="absolute top-2 left-0 size-2 rounded-full border-2 border-border bg-background" />
      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <time dateTime={note.createdAt} className="font-mono">{time}</time>
        {sourceLabel && (
          <span className="rounded bg-accent/10 px-1.5 py-0.5 font-medium text-accent">{sourceLabel}</span>
        )}
        {!editing && (
          <span className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={() => setEditing(true)} className="rounded px-1.5 py-0.5 hover:bg-surface-muted hover:text-foreground">
              Edit
            </button>
            <button type="button" onClick={remove} className="rounded px-1.5 py-0.5 text-danger hover:bg-danger/10">
              Delete
            </button>
          </span>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={NOTE_MAX_LENGTH}
            rows={Math.min(12, Math.max(3, draft.split("\n").length + 1))}
            autoFocus
            className="block w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-[15px] leading-relaxed outline-none focus:border-accent/60"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
              if (e.key === "Escape") {
                setDraft(note.content);
                setEditing(false);
              }
            }}
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={save} disabled={pending || !draft.trim()}>
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(note.content);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{note.content}</p>
      )}
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </li>
  );
}
