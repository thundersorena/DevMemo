import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { dbToDateKey, type DateKey } from "@/lib/dates";
import { db } from "./db";
import { buildSnippet, searchTerms } from "@/lib/search-text";

/**
 * Journal search: PostgreSQL full-text search (websearch syntax: "exact
 * phrase", OR, -exclude) ranked by relevance, plus a substring fallback so
 * partial words and any language still match. The `simple` text-search
 * configuration is used on purpose: no English stemming, so Persian and
 * other languages behave predictably.
 */

export type SearchType = "note" | "commit" | "summary";

export type SearchResult = {
  type: SearchType;
  id: string;
  date: DateKey;
  text: string;
  /** Short excerpt with matches wrapped in ⟦ ⟧. */
  snippet: string;
  rank: number;
  source?: string;
  provider?: string;
  repositoryName?: string;
  url?: string;
};

export type SearchOptions = {
  limit?: number;
  types?: SearchType[];
  from?: DateKey;
  to?: DateKey;
  /** Only commits from this repository (exact name). */
  repository?: string;
};

type Row = {
  type: SearchType;
  id: string;
  date: Date;
  text: string;
  source: string | null;
  provider: string | null;
  repository: string | null;
  url: string | null;
  rank: number;
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function searchJournal(userId: string, query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 200);
  const types = new Set<SearchType>(options.types?.length ? options.types : ["note", "commit", "summary"]);
  if (options.repository) {
    types.delete("note");
    types.delete("summary");
  }
  const pattern = `%${escapeLike(q)}%`;
  const from = options.from ? new Date(`${options.from}T00:00:00.000Z`) : null;
  const to = options.to ? new Date(`${options.to}T00:00:00.000Z`) : null;
  const dateFilter = Prisma.sql`${from ? Prisma.sql`AND d.date >= ${from}` : Prisma.empty} ${to ? Prisma.sql`AND d.date <= ${to}` : Prisma.empty}`;

  const parts: Prisma.Sql[] = [];
  if (types.has("note")) {
    parts.push(Prisma.sql`
      SELECT 'note' AS type, n.id, d.date, n.content AS text, n.source::text AS source,
             NULL AS provider, NULL AS repository, NULL AS url,
             ts_rank(to_tsvector('simple', n.content), q.tsq) AS rank, n."createdAt" AS at
      FROM note n JOIN day d ON d.id = n."dayId", q
      WHERE n."userId" = ${userId} ${dateFilter}
        AND (to_tsvector('simple', n.content) @@ q.tsq OR n.content ILIKE ${pattern})`);
  }
  if (types.has("commit")) {
    parts.push(Prisma.sql`
      SELECT 'commit' AS type, c.id, d.date, c.message AS text, NULL AS source,
             c.provider, c."repositoryName" AS repository, c.url,
             ts_rank(to_tsvector('simple', c.message || ' ' || c."repositoryName"), q.tsq) AS rank, c."committedAt" AS at
      FROM "commit" c JOIN day d ON d.id = c."dayId", q
      WHERE c."userId" = ${userId} ${dateFilter}
        ${options.repository ? Prisma.sql`AND c."repositoryName" = ${options.repository}` : Prisma.empty}
        AND (to_tsvector('simple', c.message || ' ' || c."repositoryName") @@ q.tsq
             OR c.message ILIKE ${pattern} OR c."repositoryName" ILIKE ${pattern})`);
  }
  if (types.has("summary")) {
    parts.push(Prisma.sql`
      SELECT 'summary' AS type, d.id, d.date, d.summary AS text, NULL AS source,
             NULL AS provider, NULL AS repository, NULL AS url,
             ts_rank(to_tsvector('simple', d.summary), q.tsq) AS rank, d."updatedAt" AS at
      FROM day d, q
      WHERE d."userId" = ${userId} AND d.summary IS NOT NULL ${dateFilter}
        AND (to_tsvector('simple', d.summary) @@ q.tsq OR d.summary ILIKE ${pattern})`);
  }
  if (parts.length === 0) return [];

  const rows = await db.$queryRaw<Row[]>`
    WITH q AS (SELECT websearch_to_tsquery('simple', ${q}) AS tsq)
    SELECT type, id, date, text, source, provider, repository, url, rank::float8 AS rank
    FROM (${Prisma.join(parts, " UNION ALL ")}) r
    ORDER BY rank DESC, date DESC, at DESC
    LIMIT ${limit}`;

  const terms = searchTerms(q);
  return rows.map((r) => ({
    type: r.type,
    id: r.id,
    date: dbToDateKey(r.date),
    text: r.text,
    snippet: buildSnippet(r.text, terms),
    rank: Number(r.rank),
    ...(r.source ? { source: r.source } : {}),
    ...(r.provider ? { provider: r.provider } : {}),
    ...(r.repository ? { repositoryName: r.repository } : {}),
    ...(r.url ? { url: r.url } : {}),
  }));
}
