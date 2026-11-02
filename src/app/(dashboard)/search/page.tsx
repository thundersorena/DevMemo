import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { requireUser } from "@/server/session";
import { searchJournal, type SearchResult, type SearchType } from "@/server/search.service";
import { formatLongDate, isValidDateKey } from "@/lib/dates";

export const metadata: Metadata = { title: "Search" };

const TYPES: { value: SearchType; label: string }[] = [
  { value: "note", label: "Notes" },
  { value: "commit", label: "Commits" },
  { value: "summary", label: "Summaries" },
];

type Params = Awaited<PageProps<"/search">["searchParams"]>;
const str = (v: Params[string]) => (typeof v === "string" ? v : undefined);

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Search your journal</h1>
      <Suspense fallback={<SearchForm params={{}} />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SearchForm({ params }: { params: Params }) {
  const selected = new Set((str(params.type) ?? "").split(",").filter(Boolean));
  return (
    <form action="/search" className="mb-8 space-y-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          defaultValue={str(params.q) ?? ""}
          minLength={2}
          maxLength={200}
          required
          placeholder='Notes, commits, repositories… try "exact phrase", OR, -exclude'
          className="h-11 w-full rounded-xl border border-border bg-surface pr-4 pl-10 text-[15px] outline-none placeholder:text-muted focus:border-accent/60"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {TYPES.map((t) => (
          <label key={t.value} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name="type"
              value={t.value}
              defaultChecked={selected.size === 0 || selected.has(t.value)}
              className="size-4 accent-[var(--accent)]"
            />
            {t.label}
          </label>
        ))}
        <span className="flex items-center gap-1.5 text-muted">
          from
          <input type="date" name="from" defaultValue={str(params.from)} className="rounded-md border border-border bg-surface px-2 py-1 text-foreground" />
          to
          <input type="date" name="to" defaultValue={str(params.to)} className="rounded-md border border-border bg-surface px-2 py-1 text-foreground" />
        </span>
        {str(params.repository) && (
          <span className="flex items-center gap-1.5">
            <input type="hidden" name="repository" value={str(params.repository)} />
            <span className="rounded bg-git/10 px-1.5 py-0.5 font-mono text-xs text-git">{str(params.repository)}</span>
            <Link href={`/search?q=${encodeURIComponent(str(params.q) ?? "")}`} className="text-xs text-muted hover:text-foreground">
              clear
            </Link>
          </span>
        )}
        <button type="submit" className="ml-auto rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background">
          Search
        </button>
      </div>
    </form>
  );
}

async function SearchContent({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const user = await requireUser();
  const raw = await searchParams;
  // Checkboxes submit repeated `type` params; normalize to one comma list.
  const typeValues = (Array.isArray(raw.type) ? raw.type : raw.type ? [raw.type] : []).flatMap((t) => t.split(","));
  const params: Params = { ...raw, type: typeValues.join(",") || undefined };

  const query = (str(params.q) ?? "").trim();
  const from = str(params.from);
  const to = str(params.to);
  const types = typeValues.filter((t): t is SearchType => TYPES.some((x) => x.value === t));
  const results =
    query.length >= 2
      ? await searchJournal(user.id, query, {
          limit: 100,
          types: types.length && types.length < 3 ? types : undefined,
          from: from && isValidDateKey(from) ? from : undefined,
          to: to && isValidDateKey(to) ? to : undefined,
          repository: str(params.repository),
        })
      : null;

  return (
    <>
      <SearchForm params={params} />
      {results === null ? (
        <p className="text-sm text-muted">Search matches whole words and parts of words, in any language.</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted">Nothing found for “{query}”.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {results.length} result{results.length === 1 ? "" : "s"}
            {results.length === 100 ? " (showing the best 100)" : ""}
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

const TYPE_STYLE: Record<SearchType, string> = {
  note: "bg-surface-muted text-foreground",
  commit: "bg-git/10 text-git",
  summary: "bg-accent/10 text-accent",
};

/** Renders ⟦match⟧ markers as <mark> without using HTML injection. */
function Highlighted({ text }: { text: string }) {
  return (
    <>
      {text.split(/(⟦[^⟧]*⟧)/g).map((part, i) =>
        part.startsWith("⟦") ? (
          <mark key={i} className="rounded bg-accent/20 px-0.5 text-foreground">
            {part.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function SearchResultItem({ result }: { result: SearchResult }) {
  return (
    <li>
      <Link
        href={`/journal/${result.date}`}
        className="block rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-accent/40"
      >
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className={`rounded px-1.5 py-0.5 font-medium ${TYPE_STYLE[result.type]}`}>{result.type}</span>
          <span>{formatLongDate(result.date)}</span>
          {result.repositoryName && (
            <span className="font-mono">
              {result.repositoryName}
              {result.provider && result.provider !== "github" ? ` · ${result.provider}` : ""}
            </span>
          )}
          {result.source === "MCP" && <span>via AI</span>}
        </div>
        <p className="line-clamp-3 text-[15px] leading-relaxed">
          <Highlighted text={result.snippet} />
        </p>
      </Link>
    </li>
  );
}
