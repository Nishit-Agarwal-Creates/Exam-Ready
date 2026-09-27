"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function isActive(pathname: string, href: string) {
  return href === "/" || href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex items-center gap-1">
      {items.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`relative inline-flex min-h-11 items-center rounded-md px-3 text-[0.95rem] font-bold transition-colors ${
                active ? "text-ink" : "text-pencil hover:text-graphite"
              }`}
            >
              {it.label}
              {active && <span aria-hidden="true" className="absolute inset-x-3 bottom-1.5 h-[2px] rounded bg-margin" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
