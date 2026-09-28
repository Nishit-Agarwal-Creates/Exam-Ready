"use client";

import Link from "next/link";
import { useState } from "react";

export type PickerClass = { level: number; name: string; slug: string; verified: number; pending: number; subjects: number };
export type PickerBoard = { slug: string; name: string; fullName: string; classes: PickerClass[] };

/** Board tabs with class tiles. Availability shown on each tile comes from the database. */
export function BoardPicker({ boards }: { boards: PickerBoard[] }) {
  const [active, setActive] = useState(boards[0]?.slug);
  const board = boards.find((b) => b.slug === active) ?? boards[0];
  if (!board) return null;
  return (
    <div>
      <div role="tablist" aria-label="Board" className="inline-flex rounded-full border border-rule bg-sheet p-1 shadow-[var(--shadow-sheet)]">
        {boards.map((b) => (
          <button
            key={b.slug}
            role="tab"
            type="button"
            aria-selected={b.slug === board.slug}
            aria-controls={`board-panel-${b.slug}`}
            id={`board-tab-${b.slug}`}
            onClick={() => setActive(b.slug)}
            className={`min-h-11 rounded-full px-5 text-[1rem] font-bold transition-colors ${b.slug === board.slug ? "bg-night text-white" : "text-pencil hover:text-graphite"}`}
          >
            {b.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`board-panel-${board.slug}`} aria-labelledby={`board-tab-${board.slug}`} className="mt-6">
        <p className="text-[0.95rem] text-pencil">{board.fullName}</p>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {board.classes.map((c, i) => (
            <li key={c.slug} className="expand-in" style={{ ["--d" as string]: `${i * 40}ms` }}>
              <Link
                href={`/${board.slug}/${c.slug}`}
                className="tilt-card flex h-full min-h-28 flex-col justify-between rounded-2xl border border-rule bg-sheet p-4"
                data-fx="ripple"
              >
                <span className="font-serif text-[1.35rem] font-semibold leading-tight">
                  Class{" "}
                  <span key={board.slug} className="numeral-roll" style={{ ["--d" as string]: `${i * 45}ms` }}>
                    {c.level}
                  </span>
                  {c.name.includes("ISC") && <span className="ml-1 font-sans text-[0.8rem] font-bold text-pencil">ISC</span>}
                </span>
                <span className="mt-3 text-[0.82rem] leading-snug">
                  {c.verified > 0 ? (
                    <span className="font-bold text-verified">{c.verified} verified PYQs</span>
                  ) : c.pending > 0 ? (
                    <span className="font-bold text-pending">{c.pending} awaiting review</span>
                  ) : (
                    <span className="text-pencil">No verified PYQs yet</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
