"use client";

import { useState } from "react";
import { ClassCard, type ClassCardData } from "@/components/class-card";

export type PickerBoard = { slug: string; name: string; fullName: string; classes: ClassCardData[] };

/** Board choice with class cards. Every count on a card comes from the database. */
export function BoardPicker({ boards }: { boards: PickerBoard[] }) {
  const [active, setActive] = useState(boards[0]?.slug);
  const board = boards.find((b) => b.slug === active) ?? boards[0];
  if (!board) return null;
  return (
    <div>
      <div role="tablist" aria-label="Board" className="board-choice">
        {boards.map((b) => (
          <button
            key={b.slug}
            role="tab"
            type="button"
            aria-selected={b.slug === board.slug}
            aria-controls={`board-panel-${b.slug}`}
            id={`board-tab-${b.slug}`}
            onClick={() => setActive(b.slug)}
            data-fx="ripple"
          >
            <span className="board-choice-name">{b.name}</span>
            <span className="board-choice-full">{b.slug === "icse" ? "ICSE and ISC (CISCE)" : "Central Board"}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`board-panel-${board.slug}`} aria-labelledby={`board-tab-${board.slug}`} className="mt-5">
        <p className="text-[0.95rem] text-pencil">{board.fullName}</p>
        <ul key={board.slug} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {board.classes.map((c, i) => (
            <li key={c.href} className="expand-in" style={{ ["--d" as string]: `${i * 45}ms` }}>
              <ClassCard c={c} style={{ ["--d" as string]: `${i * 45 + 120}ms` }} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
