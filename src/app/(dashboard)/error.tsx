"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button";

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = typeof error === "object" && error && "digest" in error ? String(error.digest) : null;

  return (
    <div role="alert" className="mx-auto max-w-lg space-y-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">
        This page failed to load. Try again; if it keeps happening, check the server logs
        {digest ? (
          <>
            {" "}
            for error <code className="font-mono">{digest}</code>
          </>
        ) : null}
        .
      </p>
      <button type="button" onClick={() => retry()} className={buttonClass("primary")}>
        Try again
      </button>
    </div>
  );
}
