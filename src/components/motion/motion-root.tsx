"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * One tiny client component drives the whole motion system with delegated listeners:
 *  - [data-reveal]      fades/rises in when scrolled into view (IntersectionObserver)
 *  - .tilt-card         tilts toward the pointer and moves a soft highlight (--rx/--ry/--px/--py)
 *  - [data-magnetic]    buttons drift slightly toward the pointer
 * Everything is skipped under prefers-reduced-motion or on coarse (touch) pointers where noted.
 */
export function MotionRoot() {
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = [...document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)")];
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

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
