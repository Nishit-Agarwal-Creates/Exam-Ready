"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { isActive } from "./nav-links";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-ghost btn-sm"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        Menu
      </button>
      <nav
        id={id}
        aria-label="Main"
        hidden={!open}
        className="absolute inset-x-0 top-16 border-b border-rule bg-sheet shadow-[var(--shadow-lift)]"
      >
        <ul className="container-page py-2">
          {items.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-12 items-center border-b border-rule text-[1.05rem] font-bold last:border-0 ${active ? "text-ink" : "text-graphite"}`}
                >
                  {it.label}
                </Link>
              </li>
            );
          })}
          <li className="py-3">
            <Link href="/practice" className="btn btn-primary w-full" onClick={() => setOpen(false)}>
              Build a paper
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
