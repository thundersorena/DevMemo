"use client";

import { useActionState } from "react";
import { updateAuthorEmailsAction, type ActionResult } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";

export function AuthorEmailsForm({ emails, accountEmail }: { emails: string[]; accountEmail: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(updateAuthorEmailsAction, null);

  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor="author-emails" className="block text-sm font-medium">
        Your commit emails
      </label>
      <p className="text-sm text-muted">
        Used to recognize your commits, especially on GitLab and Bitbucket. Your GitHub email (
        <span className="font-mono text-[13px]">{accountEmail}</span>) and GitHub username are always included.
        One per line, up to 10.
      </p>
      <textarea
        id="author-emails"
        name="emails"
        rows={3}
        defaultValue={emails.join("\n")}
        placeholder={"you@company.com\nyou@personal.dev"}
        className="block w-full max-w-md resize-y rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[13px] outline-none placeholder:text-muted focus:border-accent/60"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save emails"}
        </Button>
        {state?.ok && <span className="text-sm text-workday">Saved</span>}
        {state && !state.ok && <span role="alert" className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
