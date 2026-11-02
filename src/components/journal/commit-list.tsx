import type { CommitView } from "@/server/journal.service";
import { formatTime } from "@/lib/dates";
import { ExternalIcon } from "@/components/ui/icons";

export function CommitList({ commits, timeZone }: { commits: CommitView[]; timeZone: string }) {
  const byRepo = new Map<string, CommitView[]>();
  for (const commit of commits) {
    const list = byRepo.get(commit.repositoryName) ?? [];
    list.push(commit);
    byRepo.set(commit.repositoryName, list);
  }

  return (
    <div className="space-y-5">
      {[...byRepo.entries()].map(([repo, list]) => (
        <div key={repo}>
          <h3 className="mb-2 flex items-center gap-2 font-mono text-sm font-medium">
            {repo}
            <span className="font-sans text-xs font-normal text-muted">
              {list.length} commit{list.length === 1 ? "" : "s"}
            </span>
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {list.map((commit) => (
              <li key={commit.id}>
                <a
                  href={commit.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-3 px-3 py-2.5 text-sm transition hover:bg-surface-muted"
                >
                  <code className="mt-0.5 shrink-0 rounded bg-git/10 px-1.5 py-0.5 font-mono text-xs text-git">
                    {commit.sha.slice(0, 7)}
                  </code>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{commit.message.split("\n")[0]}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {formatTime(new Date(commit.committedAt), timeZone)}
                      {commit.branch ? ` · ${commit.branch}` : ""}
                    </span>
                  </span>
                  <ExternalIcon className="mt-1 size-3.5 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
