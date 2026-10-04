"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { isActive } from "./nav-links";

/**
 * Mobile menu: a panel under the header with a backdrop. Opening moves focus into it and keeps Tab inside;
 * Escape, the backdrop or following a link closes it and returns focus to the button. The page behind doesn't scroll.
 */
export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // "Build a paper" is the panel's primary action, so the plain /practice link isn't repeated above it.
  const links = items.filter((it) => it.href !== "/practice");

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  // Close when the route changes (a link was followed, or back/forward): derived during render, not in an effect.
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a,button")?.focus();
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = [buttonRef.current, ...panel.querySelectorAll<HTMLElement>("a[href],button")].filter(Boolean) as HTMLElement[];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-ghost btn-sm relative z-50"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        <span className="max-[359px]:sr-only">{open ? "Close" : "Menu"}</span>
      </button>
      {open && <div className="mobile-nav-backdrop" aria-hidden="true" onClick={() => close(false)} />}
      <div ref={panelRef} id={id} hidden={!open} className="mobile-nav-panel">
        <nav aria-label="Main">
          <ul className="container-page py-2">
            {links.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-12 items-center gap-2 border-b border-rule text-[1.05rem] font-bold ${active ? "text-ink" : "text-graphite"}`}
                  >
                    {active && <span className="h-5 w-1 rounded-full bg-ink" aria-hidden="true" />}
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
    </div>
  );
}
