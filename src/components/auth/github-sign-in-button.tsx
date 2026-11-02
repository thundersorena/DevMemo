"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { GitHubIcon } from "@/components/ui/icons";

export function GitHubSignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.social({
      provider: "github",
      callbackURL: "/calendar",
    });
    // On success the browser navigates to GitHub, so we only land here on failure.
    if (error) {
      setError(error.message ?? "Could not start GitHub sign-in");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="primary" size="lg" className="w-full" onClick={signIn} disabled={pending}>
        <GitHubIcon className="size-[18px]" />
        {pending ? "Redirecting to GitHub…" : "Continue with GitHub"}
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
