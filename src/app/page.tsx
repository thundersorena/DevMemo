import type { Metadata } from "next";
import Link from "next/link";
import { JournalPreview } from "@/components/landing/journal-preview";
import { LandingHeader } from "@/components/landing/landing-header";
import { McpPreview } from "@/components/landing/mcp-preview";
import { REPO_URL } from "@/components/landing/constants";
import { buttonClass } from "@/components/ui/button";
import { GitHubIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: { absolute: "DevMemo · Your developer memory, connected" },
  description:
    "An open-source personal developer journal that tracks daily work, Git activity, and connects with AI assistants through MCP.",
};

const SOURCES = [
  {
    tag: "Journal",
    color: "text-foreground bg-surface-muted",
    title: "What happened",
    body: "Write what you worked on, investigated, decided and left unfinished. One timeline per day, with notes you can edit any time.",
  },
  {
    tag: "Git",
    color: "text-git bg-git/10",
    title: "What changed",
    body: "Commits arrive automatically from GitHub and land on the right day in your timezone. They stay separate from your notes.",
  },
  {
    tag: "AI",
    color: "text-accent bg-accent/10",
    title: "What it means",
    body: "Connect Claude or any MCP client to ask about your history, summarize a week, or add a note without leaving your editor.",
  },
];

const STEPS = [
  {
    title: "Sign in with GitHub",
    body: "No passwords, no setup wizard. Your journal is ready the moment you sign in.",
  },
  {
    title: "Write and push",
    body: "Jot down notes as you work. Push code as usual, and your commits show up on the calendar.",
  },
  {
    title: "Ask your history",
    body: "Point your AI assistant at DevMemo and ask what you did, when, and why.",
  },
];

const QUESTIONS = [
  "What did I work on yesterday?",
  "Summarize my development activity this week.",
  "Which repositories did I touch last month?",
  "What problems did I investigate this week?",
  "Mark today as a workday.",
];

const NOT_LIST = ["A Jira replacement", "A task board", "A team analytics dashboard", "A RAG infrastructure project"];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingHeader />

      <main className="flex-1 overflow-x-clip">
        {/* ─── Hero ─────────────────────────────────────────────── */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:gap-12 [&>*]:min-w-0">
          <div>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted transition hover:text-foreground"
            >
              <span className="size-1.5 rounded-full bg-workday" />
              Open source · MIT licensed
            </a>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]">
              Remember what you <span className="text-muted">did</span>, not just what you{" "}
              <span className="text-muted">changed</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              DevMemo is a personal developer journal. It puts your daily notes and your Git activity on one
              calendar, and lets your AI assistant search and update it through MCP.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/login" className={buttonClass("primary", "", "lg")}>
                <GitHubIcon className="size-[18px]" />
                Start with GitHub
              </Link>
              <a href="#how-it-works" className={buttonClass("secondary", "", "lg")}>
                How it works
              </a>
            </div>
            <p className="mt-5 text-sm text-muted">Free to use. Or self-host it with one Docker command.</p>
          </div>
          <JournalPreview />
        </section>

        {/* ─── Problem ──────────────────────────────────────────── */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
            <p className="text-sm font-medium text-accent">The missing context</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
              Git remembers the diff. Nobody remembers the day.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              Why was this approach chosen? What did you spend Tuesday debugging? What is still unresolved? That
              context lives in your head for a week, then it’s gone. DevMemo keeps it, next to the commits it
              explains.
            </p>
          </div>
        </section>

        {/* ─── Three sources ────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">Three sources, one timeline</h2>
            <p className="mt-3 text-lg text-muted">Each kind of information keeps its origin. Nothing overwrites anything else.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {SOURCES.map((s) => (
              <article key={s.tag} className="rounded-2xl border border-border bg-surface p-6">
                <span className={`inline-block rounded-md px-2 py-0.5 font-mono text-xs font-medium ${s.color}`}>{s.tag}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── How it works ─────────────────────────────────────── */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <h2 className="mb-12 text-3xl font-semibold tracking-tight">How it works</h2>
            <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className="font-mono text-sm text-muted">0{i + 1}</span>
                  <div className="mt-3 h-px bg-border" />
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─── MCP ──────────────────────────────────────────────── */}
        <section id="mcp" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <p className="text-sm font-medium text-accent">Model Context Protocol</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
              Your AI assistant answers from your actual history.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              DevMemo exposes your journal as MCP tools. Claude Desktop, Claude Code and other MCP clients can read
              days, search notes and commits, and add notes, so answers come from your records, not from guesses.
            </p>
            <ul className="mt-8 space-y-2.5">
              {QUESTIONS.map((q) => (
                <li key={q} className="flex items-start gap-3 text-[15px]">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  <span>“{q}”</span>
                </li>
              ))}
            </ul>
          </div>
          <McpPreview />
        </section>

        {/* ─── Principles ───────────────────────────────────────── */}
        <section id="principles" className="scroll-mt-20 border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Small on purpose</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                A small tool that works reliably beats a large one with infrastructure you don’t need.
              </p>
              <dl className="mt-8 space-y-5">
                {[
                  ["AI is optional", "The journal works fully without any AI provider configured."],
                  ["Your notes stay yours", "Git sync and AI never overwrite what you wrote. Every note records where it came from."],
                  ["One database is the truth", "Web, API and MCP all go through the same service, with the same rules."],
                ].map(([title, body]) => (
                  <div key={title}>
                    <dt className="font-medium">{title}</dt>
                    <dd className="mt-1 text-muted">{body}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-2xl border border-dashed border-border p-6 sm:p-8">
              <p className="text-sm font-semibold tracking-wider text-muted uppercase">DevMemo is not</p>
              <ul className="mt-5 space-y-3">
                {NOT_LIST.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-[15px] text-muted">
                    <span className="font-mono text-danger">×</span>
                    <span className="line-through decoration-border">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[15px] leading-relaxed">
                It’s a personal memory for software developers. Nothing more, on purpose.
              </p>
            </div>
          </div>
        </section>

        {/* ─── CTA ──────────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Start remembering your work.</h2>
          <p className="mt-4 text-lg text-muted">Sign in with GitHub and write your first note in under a minute.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className={buttonClass("primary", "", "lg")}>
              <GitHubIcon className="size-[18px]" />
              Start with GitHub
            </Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={buttonClass("secondary", "", "lg")}>
              View source
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <Logo size="sm" />
          <p>Open source under the MIT License.</p>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="transition hover:text-foreground">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
