"use client";

import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/**
 * Approve / deny an OAuth authorization. The oauthProviderClient plugin
 * attaches the signed request from the page URL, so the server knows which
 * authorization this decision is for.
 */
export function ConsentButtons() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const { data, error } = await authClient.oauth2.consent({ accept });
      if (error) {
        console.error("[consent]", error);
        setError(error.message || error.statusText || "Could not complete the authorization");
        return;
      }
      const url = (data as { url?: string } | null)?.url;
      if (url) window.location.href = url;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" className="flex-1" disabled={pending} onClick={() => decide(false)}>
          Deny
        </Button>
        <Button variant="primary" size="lg" className="flex-1" disabled={pending} onClick={() => decide(true)}>
          {pending ? "Connecting…" : "Allow access"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
