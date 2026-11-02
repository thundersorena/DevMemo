import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { GitHubIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { REPO_URL } from "./constants";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="DevMemo home" className="shrink-0">
          <Logo priority />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {[
            ["#how-it-works", "How it works"],
            ["#mcp", "AI & MCP"],
            ["#principles", "Principles"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-md px-3 py-1.5 text-sm text-muted transition hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="DevMemo on GitHub"
            className={buttonClass("ghost", "", "icon")}
          >
            <GitHubIcon className="size-[18px]" />
          </a>
          <Link href="/login" className={buttonClass("primary")}>
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
