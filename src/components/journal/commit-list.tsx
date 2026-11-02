import type { CommitView } from "@/server/journal.service";
import { formatTime } from "@/lib/dates";
import { ExternalIcon } from "@/components/ui/icons";

export function CommitList({
  commits,
  timeZone,
}: {
  commits: CommitView[];
  timeZone: string;
}) {
  const byRepo = new Map<string, CommitView[]>();
  for (const commit of commits) {
    // Same name can exist on several providers; keep them apart.
    const key = `${commit.provider}:${commit.repositoryName}`;
    const list = byRepo.get(key) ?? [];
    list.push(commit);
    byRepo.set(key, list);
  }

  return (
    <div className="space-y-5">
      {[...byRepo.entries()].map(([key, list]) => {
        const repo = list[0].repositoryName;
        return (
          <div key={key}>
            <h3 className="mb-2 flex items-center gap-2 font-mono text-sm font-medium">
              {repo}
              {list[0].provider !== "github" && (
                <span className="rounded bg-surface-muted px-1.5 py-0.5 font-sans text-[11px] font-normal text-muted">
                  {list[0].provider === "gitlab" ? "GitLab" : "Bitbucket"}
                </span>
              )}
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
                      <span className="block truncate">
                        {commit.message.split("\n")[0]}
                      </span>
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
        );
      })}
    </div>
  );
}
