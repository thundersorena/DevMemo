/** Pure helpers for search highlighting (shared by server and tests). */

/** Words to highlight: query terms without websearch operators. */
export function searchTerms(query: string): string[] {
  const terms = new Set<string>();
  for (const match of query.matchAll(/"([^"]+)"|(\S+)/g)) {
    const raw = (match[1] ?? match[2] ?? "").trim();
    if (!raw || raw.toLowerCase() === "or" || raw.startsWith("-")) continue;
    const term = raw.replace(/^[+(]+|[)]+$/g, "");
    if (term.length >= 2) terms.add(term);
  }
  return [...terms].sort((a, b) => b.length - a.length);
}

/** Excerpt around the first match with every term wrapped in ⟦ ⟧. */
export function buildSnippet(text: string, terms: string[], radius = 90): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (terms.length === 0) return flat.slice(0, radius * 2);
  const lower = flat.toLowerCase();
  let first = -1;
  for (const t of terms) {
    const i = lower.indexOf(t.toLowerCase());
    if (i !== -1 && (first === -1 || i < first)) first = i;
  }
  const start = first === -1 ? 0 : Math.max(0, first - radius);
  const end = Math.min(flat.length, (first === -1 ? 0 : first) + radius * 2);
  let excerpt = flat.slice(start, end);
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  excerpt = excerpt.replace(pattern, "⟦$1⟧");
  return `${start > 0 ? "… " : ""}${excerpt}${end < flat.length ? " …" : ""}`;
}
