"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Filters that sit inline on large screens and collapse into a bottom sheet on phones behind a "Filters (n)" button.
 * Before hydration (or without JS) the filters render inline everywhere, so the plain GET form still works.
 */
export function FilterDrawer({ count, children }: { count: number; children: React.ReactNode }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    sheetRef.current?.querySelector<HTMLElement>("input:not([type=hidden]),select,button")?.focus();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      const sheet = sheetRef.current;
      if (e.key !== "Tab" || !sheet) return;
      const els = [...sheet.querySelectorAll<HTMLElement>("a[href],button,input:not([type=hidden]),select,textarea")];
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    // The sheet only exists below lg; growing the window past it closes the sheet.
    const mq = window.matchMedia("(min-width: 64rem)");
    const onMq = () => mq.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      html.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="filter-drawer" data-ready={hydrated || undefined} data-open={open || undefined}>
      <button
        ref={toggleRef}
        type="button"
        className="btn btn-secondary filter-drawer-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        Filters{count > 0 ? ` (${count})` : ""}
      </button>
      {open && <div className="filter-drawer-backdrop" aria-hidden="true" onClick={close} />}
      <div ref={sheetRef} id={id} className="filter-drawer-sheet" role={open ? "dialog" : undefined} aria-modal={open || undefined} aria-label={open ? "Filters" : undefined}>
        <div className="filter-drawer-head">
          <span className="font-bold">Filters</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
