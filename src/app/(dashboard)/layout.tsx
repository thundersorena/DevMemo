import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, NavLinksFallback, type NavItem } from "@/components/layout/nav-link";
import { UserMenu, UserMenuFallback } from "@/components/layout/user-menu";
import { Logo } from "@/components/ui/logo";

const NAV: NavItem[] = [
  { href: "/calendar", match: "/calendar", label: "Calendar" },
  { href: "/journal/today", match: "/journal", label: "Journal" },
  { href: "/reports", match: "/reports", label: "Reports" },
  { href: "/repos", match: "/repos", label: "Repos" },
  { href: "/search", match: "/search", label: "Search" },
  { href: "/settings", match: "/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <Link href="/calendar" aria-label="DevMemo home" className="shrink-0">
              <Logo compact priority />
            </Link>
            <nav className="-mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto px-1 sm:gap-1">
              <Suspense fallback={<NavLinksFallback items={NAV} />}>
                <NavLinks items={NAV} />
              </Suspense>
            </nav>
          </div>
          <Suspense fallback={<UserMenuFallback />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
