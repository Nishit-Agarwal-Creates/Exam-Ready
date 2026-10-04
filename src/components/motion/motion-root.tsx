"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * One tiny client component drives the whole motion system with delegated listeners:
 *  - [data-reveal]      fades/rises in when scrolled into view (IntersectionObserver)
 *  - .tilt-card         tilts toward the pointer and moves a soft highlight (--rx/--ry/--px/--py)
 *  - [data-magnetic]    buttons drift slightly toward the pointer
 *  - [data-fx]          press feedback: "pulse" (electric ring) and/or "ripple" (ink), see globals.css
 * Everything is skipped under prefers-reduced-motion or on coarse (touch) pointers where noted.
 */
export function MotionRoot() {
  const pathname = usePathname();

  // One observer for the page's lifetime. A MutationObserver hands it every [data-reveal] element added later
  // (pagination, filters and client navigations replace content without a pathname change), so new content can
  // never stay hidden. Pathname is a dependency only as a safety net.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = (el: Element) => el.classList.add("is-visible");
    const io =
      reduce || !("IntersectionObserver" in window)
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                if (e.isIntersecting) {
                  reveal(e.target);
                  io?.unobserve(e.target);
                }
              }
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
          );
    const track = (root: Document | Element) => {
      const found = root instanceof Element && root.matches("[data-reveal]:not(.is-visible)") ? [root] : [];
      found.push(...root.querySelectorAll("[data-reveal]:not(.is-visible)"));
      for (const el of found) (io ? io.observe(el) : reveal(el));
    };
    track(document);
    const mo = new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n instanceof Element) track(n);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io?.disconnect();
    };
  }, [pathname]);

  // Press feedback (mouse and touch): data-fx="pulse" draws an electric ring with sparks from the
  // press point; data-fx="ripple" spreads ink inside the element. Transient spans remove themselves.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-fx]");
      if (!el || el.matches(":disabled,[aria-disabled='true']")) return;
      const kinds = (el.dataset.fx ?? "").split(" ");
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      const onNight = Boolean(el.closest(".night"));
      if (kinds.includes("pulse")) {
        const burst = document.createElement("span");
        burst.className = "fx-burst";
        burst.setAttribute("aria-hidden", "true");
        burst.style.setProperty("--fx-x", `${x}px`);
        burst.style.setProperty("--fx-y", `${y}px`);
        burst.style.setProperty("--fx-size", `${Math.max(90, Math.min(220, r.width * 0.9))}px`);
        if (!onNight) burst.style.setProperty("--fx-color", "#4f63ff");
        for (let i = 0; i < 6; i++) {
          const spark = document.createElement("i");
          spark.style.setProperty("--a", `${i * 60 + ((x + y) % 40)}deg`);
          spark.style.setProperty("--reach", `${22 + (i % 3) * 8}px`);
          burst.appendChild(spark);
        }
        el.appendChild(burst);
        setTimeout(() => burst.remove(), 650);
      }
      if (kinds.includes("ripple")) {
        const layer = document.createElement("span");
        layer.className = "fx-layer";
        layer.setAttribute("aria-hidden", "true");
        const ink = document.createElement("span");
        ink.className = "fx-ink";
        ink.style.setProperty("--fx-x", `${x}px`);
        ink.style.setProperty("--fx-y", `${y}px`);
        ink.style.setProperty("--fx-size", `${Math.hypot(r.width, r.height) * 2}px`);
        if (onNight) ink.style.setProperty("--fx-color", "#6fe3ff");
        layer.appendChild(ink);
        el.appendChild(layer);
        setTimeout(() => layer.remove(), 700);
      }
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      const target = e.target as Element | null;
      const card = target?.closest?.<HTMLElement>(".tilt-card");
      if (card) {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--ry", `${(x - 0.5) * 6}deg`);
        card.style.setProperty("--rx", `${(0.5 - y) * 6}deg`);
        card.style.setProperty("--px", `${x * 100}%`);
        card.style.setProperty("--py", `${y * 100}%`);
      }
      const mag = target?.closest?.<HTMLElement>("[data-magnetic]");
      if (mag) {
        const r = mag.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        mag.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28}px)`;
      }
    };
    const onMove = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onOut = (e: PointerEvent) => {
      const from = e.target as Element | null;
      const card = from?.closest?.<HTMLElement>(".tilt-card");
      if (card && !card.contains(e.relatedTarget as Node)) {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      }
      const mag = from?.closest?.<HTMLElement>("[data-magnetic]");
      if (mag && !mag.contains(e.relatedTarget as Node)) mag.style.transform = "";
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
