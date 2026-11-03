import type { Metadata } from "next";
import { Suspense } from "react";
import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";
import { Logo } from "@/components/ui/logo";
import { getClientName } from "@/server/oauth-apps.service";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Logo size="lg" priority className="mb-10" />
        <Suspense fallback={null}>
          <OAuthContext searchParams={searchParams} />
        </Suspense>
        <h1 className="text-2xl font-semibold tracking-tight">Your developer memory.</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          A daily journal for what you did, investigated and decided, connected to your
          Git activity and your AI assistant.
        </p>
        <div className="mt-8">
          <GitHubSignInButton />
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted">
          We only read your public profile and email. Repository access is requested
          separately, if you choose to connect Git activity.
        </p>
      </div>
    </main>
  );
}

async function OAuthContext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const clientId = typeof params.client_id === "string" ? params.client_id : null;
  if (!clientId || typeof params.sig !== "string") return null;

  const name = await getClientName(clientId.slice(0, 512));
  if (!name) return null;

  return (
    <p className="mb-6 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
      Sign in to connect <b>{name}</b> to your DevMemo journal.
    </p>
  );
}
