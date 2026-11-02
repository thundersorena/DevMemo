"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyMarkdownButton({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(markdown);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable; the download link still works
        }
      }}
    >
      {copied ? "Copied" : "Copy as Markdown"}
    </Button>
  );
}
