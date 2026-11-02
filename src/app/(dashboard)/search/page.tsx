import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { searchJournal, type SearchResult } from "@/server/journal.service";
import { requireUser } from "@/server/session";
import { formatLongDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Search your journal</h1>
      <Suspense fallback={<SearchForm />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SearchForm({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/search" className="relative mb-8">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        minLength={2}
        maxLength={200}
        required
        placeholder="Notes, commit messages, repositories…"
        className="h-11 w-full rounded-xl border border-border bg-surface pr-4 pl-10 text-[15px] outline-none placeholder:text-muted focus:border-accent/60"
      />
    </form>
  );
}

async function SearchContent({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const results = query.length >= 2 ? await searchJournal(user.id, query, 50) : null;

  return (
    <>
      <SearchForm defaultValue={query} />
      {results === null ? null : results.length === 0 ? (
        <p className="text-sm text-muted">Nothing found for “{query}”.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {results.length} result{results.length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-2">
            {results.map((r) => (
              <SearchResultItem key={`${r.type}-${r.id}`} result={r} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

const TYPE_STYLE: Record<SearchResult["type"], string> = {
  note: "bg-surface-muted text-foreground",
  commit: "bg-git/10 text-git",
  summary: "bg-accent/10 text-accent",
};

function SearchResultItem({ result }: { result: SearchResult }) {
  return (
    <li>
      <Link
        href={`/journal/${result.date}`}
        className="block rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-accent/40"
      >
        <div className="mb-1 flex items-center gap-2 text-xs text-muted">
          <span className={`rounded px-1.5 py-0.5 font-medium ${TYPE_STYLE[result.type]}`}>{result.type}</span>
          <span>{formatLongDate(result.date)}</span>
          {result.type === "commit" && <span className="font-mono">{result.repositoryName}</span>}
        </div>
        <p className="line-clamp-3 text-[15px] leading-relaxed whitespace-pre-wrap">{result.text}</p>
      </Link>
    </li>
  );
}
