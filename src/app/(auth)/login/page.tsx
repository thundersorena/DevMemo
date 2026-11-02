import type { Metadata } from "next";
import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Logo className="mb-10 text-lg" />
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
