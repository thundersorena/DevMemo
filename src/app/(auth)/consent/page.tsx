import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { ConsentButtons } from "@/components/auth/consent-buttons";
import { CheckIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { auth } from "@/server/auth";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Authorize access", robots: { index: false } };

type PublicClient = { client_id: string; client_name?: string; client_uri?: string; logo_uri?: string };

const ABILITIES = [
  "Read your journal: days, notes, Git commits and summaries",
  "Search your journal",
  "Add notes (marked “via AI”), mark workdays and save summaries",
];

const SCOPE_TEXT: Record<string, string> = {
  profile: "See your name and avatar",
  email: "See your email address",
  offline_access: "Stay connected without asking you again",
};

export default function ConsentPage({ searchParams }: PageProps<"/consent">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Logo size="lg" className="mb-8" />
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl border border-border bg-surface" />}>
          <ConsentCard searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function ConsentCard({ searchParams }: Pick<PageProps<"/consent">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const clientId = typeof params.client_id === "string" ? params.client_id : "";
  const scopes = (typeof params.scope === "string" ? params.scope : "").split(" ").filter(Boolean);

  let client: PublicClient | null = null;
  try {
    client = (await auth.api.getOAuthClientPublic({
      query: { client_id: clientId },
      headers: await headers(),
    })) as PublicClient;
  } catch {
    client = null;
  }

  if (!client) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold">Unknown application</h1>
        <p className="mt-2 text-sm text-muted">
          This authorization request is invalid or has expired. Start the connection again from your app.
        </p>
      </div>
    );
  }

  const name = client.client_name || "An application";
  // Client metadata is self-declared; show where it really comes from.
  let origin: string | null = null;
  for (const candidate of [client.client_id, client.client_uri]) {
    try {
      if (candidate) {
        origin = new URL(candidate).host;
        break;
      }
    } catch {
      // not a URL
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0_24px_60px_-28px_rgb(0_0_0/0.25)]">
      <div className="flex items-center gap-3">
        {client.logo_uri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={client.logo_uri} alt="" className="size-10 rounded-lg border border-border object-contain" />
        ) : (
          <span className="grid size-10 place-items-center rounded-lg bg-surface-muted text-lg font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-lg leading-tight font-semibold">{name}</h1>
          {origin && <p className="truncate text-xs text-muted">{origin}</p>}
        </div>
      </div>

      <p className="mt-5 text-[15px] leading-relaxed">
        <b>{name}</b> wants to connect to your DevMemo journal as an MCP client. It will be able to:
      </p>
      <ul className="mt-3 space-y-2">
        {[...ABILITIES, ...scopes.map((s) => SCOPE_TEXT[s]).filter(Boolean)].map((text) => (
          <li key={text} className="flex items-start gap-2.5 text-sm">
            <CheckIcon className="mt-0.5 size-4 text-workday" />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 rounded-lg bg-surface-muted/60 px-3 py-2 text-xs leading-relaxed text-muted">
        Signed in as <b className="text-foreground">{user.name}</b> ({user.email}). Only allow apps you trust. You
        can revoke access anytime in Settings.
      </p>

      <div className="mt-5">
        <ConsentButtons />
      </div>
    </div>
  );
}
