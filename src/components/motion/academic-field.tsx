"use client";

import { useEffect, useRef } from "react";

/**
 * A small physics field for the homepage hero. Children marked [data-field-object] (with
 * data-depth and data-charge) are moved with transforms only:
 *   - desktop: parallax by depth, plus a push (charge > 0) or pull (charge < 0) from the cursor,
 *     with faint field lines to nearby objects
 *   - focus: while anything inside [data-field-focus] has focus, objects drift toward the centre card
 *   - touch: a tap sends a ripple and nudges nearby objects; scrolling drifts them gently by depth
 * The animation loop only runs while something is moving and the hero is on screen. Reduced motion
 * leaves every object where it was laid out.
 */
type Body = { el: HTMLElement; line: SVGLineElement | null; cx: number; cy: number; depth: number; charge: number; x: number; y: number; vx: number; vy: number };

export function AcademicField({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = ref.current;
    const svg = svgRef.current;
    if (!root || !svg) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fine = window.matchMedia("(pointer: fine)").matches;

    let bodies: Body[] = [];
    let w = 1;
    let h = 1;
    const measure = () => {
      w = root.clientWidth || 1;
      h = root.clientHeight || 1;
      for (const b of bodies) {
        // offsetLeft/Top ignore transforms, so measuring never feeds back into the motion.
        b.cx = b.el.offsetLeft + b.el.offsetWidth / 2;
        b.cy = b.el.offsetTop + b.el.offsetHeight / 2;
      }
    };
    const NS = "http://www.w3.org/2000/svg";
    bodies = [...root.querySelectorAll<HTMLElement>("[data-field-object]")].map((el) => {
      let line: SVGLineElement | null = null;
      if (fine) {
        line = document.createElementNS(NS, "line");
        line.setAttribute("opacity", "0");
        svg.appendChild(line);
      }
      return { el, line, cx: 0, cy: 0, depth: Number(el.dataset.depth ?? 14), charge: Number(el.dataset.charge ?? 1), x: 0, y: 0, vx: 0, vy: 0 };
    });
    measure();

    let px = -1e4;
    let py = -1e4;
    let inside = false;
    let inHero = false;
    let focused = false;
    let scrollDrift = 0;
    let visible = true;
    let frame = 0;
    const R = 230;

    const step = () => {
      frame = 0;
      const clamp = (v: number) => Math.max(-1.4, Math.min(1.4, v));
      const mx = inHero ? clamp((px / w - 0.5) * 2) : 0;
      const my = inHero ? clamp((py / h - 0.5) * 2) : 0;
      let moving = false;
      for (const b of bodies) {
        let tx = mx * b.depth;
        let ty = my * b.depth - scrollDrift * b.depth;
        const ox = b.cx + b.x;
        const oy = b.cy + b.y;
        let near = 0;
        if (inside) {
          const dx = ox - px;
          const dy = oy - py;
          const d = Math.max(1, Math.hypot(dx, dy));
          if (d < R) {
            near = 1 - d / R;
            const f = near * near * 46 * b.charge;
            tx += (dx / d) * f;
            ty += (dy / d) * f;
          }
        }
        if (focused) {
          tx += (w / 2 - b.cx) * 0.2;
          ty += (h / 2 - b.cy) * 0.2;
        }
        b.vx = (b.vx + (tx - b.x) * 0.075) * 0.8;
        b.vy = (b.vy + (ty - b.y) * 0.075) * 0.8;
        b.x += b.vx;
        b.y += b.vy;
        const rot = Math.max(-14, Math.min(14, b.vx * 1.4));
        b.el.style.transform = `translate3d(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        if (b.line) {
          if (near > 0.05) {
            b.line.setAttribute("x1", px.toFixed(1));
            b.line.setAttribute("y1", py.toFixed(1));
            b.line.setAttribute("x2", (b.cx + b.x).toFixed(1));
            b.line.setAttribute("y2", (b.cy + b.y).toFixed(1));
            b.line.setAttribute("opacity", (near * 0.55).toFixed(3));
          } else if (b.line.getAttribute("opacity") !== "0") b.line.setAttribute("opacity", "0");
        }
        if (Math.abs(b.vx) + Math.abs(b.vy) > 0.02 || Math.abs(tx - b.x) + Math.abs(ty - b.y) > 0.3) moving = true;
      }
      if (moving && visible) frame = requestAnimationFrame(step);
    };
    const wake = () => {
      if (!frame && visible) frame = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const r = root.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
      inside = px >= -40 && py >= -40 && px <= r.width + 40 && py <= r.height + 40;
      inHero = true;
      wake();
    };
    const onLeave = () => {
      inside = false;
      inHero = false;
      wake();
    };
    const onTap = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      const r = root.getBoundingClientRect();
      const tx = e.clientX - r.left;
      const ty = e.clientY - r.top;
      const ring = document.createElement("span");
      ring.className = "field-tap";
      ring.style.left = `${tx - 110}px`;
      ring.style.top = `${ty - 110}px`;
      root.appendChild(ring);
      setTimeout(() => ring.remove(), 850);
      for (const b of bodies) {
        const dx = b.cx + b.x - tx;
        const dy = b.cy + b.y - ty;
        const d = Math.max(1, Math.hypot(dx, dy));
        const f = Math.max(0, 1 - d / 320) * 16;
        b.vx += (dx / d) * f;
        b.vy += (dy / d) * f;
      }
      wake();
    };
    let lastScroll = 0;
    const onScroll = () => {
      const now = performance.now();
      if (now - lastScroll < 16) return;
      lastScroll = now;
      const r = root.getBoundingClientRect();
      scrollDrift = Math.max(-1, Math.min(1.5, -r.top / Math.max(1, r.height)));
      wake();
    };
    const focusHost = root.closest("section")?.querySelector<HTMLElement>("[data-field-focus]");
    const onFocusIn = () => {
      focused = true;
      wake();
    };
    const onFocusOut = () => {
      focused = false;
      wake();
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    });
    io.observe(root);
    const ro = new ResizeObserver(() => {
      measure();
      wake();
    });
    ro.observe(root);

    const pointerHost = root.closest("section") ?? root;
    if (fine) {
      pointerHost.addEventListener("pointermove", onMove as EventListener, { passive: true });
      pointerHost.addEventListener("pointerleave", onLeave, { passive: true });
    } else {
      root.addEventListener("pointerdown", onTap as EventListener, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    focusHost?.addEventListener("focusin", onFocusIn);
    focusHost?.addEventListener("focusout", onFocusOut);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      pointerHost.removeEventListener("pointermove", onMove as EventListener);
      pointerHost.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onTap as EventListener);
      window.removeEventListener("scroll", onScroll);
      focusHost?.removeEventListener("focusin", onFocusIn);
      focusHost?.removeEventListener("focusout", onFocusOut);
      for (const b of bodies) {
        b.line?.remove();
        b.el.style.transform = "";
      }
    };
  }, []);

  return (
    <div ref={ref} className={`field ${className}`}>
      <svg ref={svgRef} className="field-lines" aria-hidden="true" />
      {children}
    </div>
  );
}
