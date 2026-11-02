import { requireUser } from "@/server/session";
import { SignOutButton } from "./sign-out-button";

export async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="flex items-center gap-2">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-7 rounded-full border border-border" />
        ) : (
          <span className="grid size-7 place-items-center rounded-full bg-surface-muted text-xs font-medium">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
      </div>
      <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
      <SignOutButton />
    </div>
  );
}

export function UserMenuFallback() {
  return <div className="h-7 w-32 animate-pulse rounded-full bg-surface-muted" />;
}
