"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; match: string; label: string };

function linkClass(active: boolean) {
  return `shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition sm:px-2.5 ${
    active ? "bg-surface-muted font-medium text-foreground" : "text-muted hover:text-foreground"
  }`;
}

/** Links with active state. Reads the URL, so render it inside <Suspense>. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return items.map((item) => {
    const active = pathname.startsWith(item.match);
    return (
      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
        {item.label}
      </Link>
    );
  });
}

/** Static fallback used in the prerendered shell. */
export function NavLinksFallback({ items }: { items: NavItem[] }) {
  return items.map((item) => (
    <Link key={item.href} href={item.href} className={linkClass(false)}>
      {item.label}
    </Link>
  ));
}
