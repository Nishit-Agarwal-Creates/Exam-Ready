"use client";

import { useEffect, useId, useRef, useState } from "react";

type Suggestions = { subjects: string[]; chapters: [string, string][] };
type Option = { value: string; label: string; hint?: string; kind: "recent" | "subject" | "chapter" };

const RECENT_KEY = "er:recent-searches";
const MAX_RECENT = 6;
const MAX_OPTIONS = 8;

let suggestionsPromise: Promise<Suggestions> | null = null;
function loadSuggestions() {
  suggestionsPromise ??= fetch("/api/suggestions")
    .then((r) => (r.ok ? (r.json() as Promise<Suggestions>) : { subjects: [], chapters: [] }))
    .catch(() => {
      suggestionsPromise = null;
      return { subjects: [], chapters: [] };
    });
  return suggestionsPromise;
}

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}
function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // Storage blocked (private mode): recent searches simply aren't kept.
  }
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
/** Every typed word must start a word of the label; earlier and chapter-start matches rank first. */
function score(label: string, typed: string[]) {
  const lw = words(label);
  let total = 0;
  for (const t of typed) {
    const i = lw.findIndex((w) => w.startsWith(t));
    if (i < 0) return -1;
    total += i;
  }
  return total;
}

/**
 * The search input with suggestions (ARIA 1.2 combobox): recent searches when empty, then matching chapters and
 * subjects as you type. Choosing one fills the box and submits the form. Without JS it is a plain search input.
 */
export function SearchBox({ id, defaultValue = "", placeholder, className }: { id: string; defaultValue?: string; placeholder?: string; className?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [data, setData] = useState<Suggestions | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Remember what was searched when the form is submitted (by Enter, the button or a suggestion).
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onSubmit = () => {
      const q = inputRef.current?.value.trim();
      if (!q) return;
      writeRecent([q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())]);
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  const typed = words(value);
  let options: Option[];
  if (typed.length === 0) {
    options = recent.map((r) => ({ value: r, label: r, kind: "recent" }));
  } else if (value.trim().length < 2 || !data) {
    options = [];
  } else {
    const recentHits = recent.filter((r) => score(r, typed) >= 0 && r.toLowerCase() !== value.trim().toLowerCase()).slice(0, 2);
    const ranked: (Option & { s: number })[] = [];
    for (const [name, hint] of data.chapters) {
      const s = score(name, typed);
      if (s >= 0) ranked.push({ value: name, label: name, hint, kind: "chapter", s });
    }
    for (const name of data.subjects) {
      const s = score(name, typed);
      if (s >= 0) ranked.push({ value: name, label: name, hint: "Subject", kind: "subject", s: s + 0.5 });
    }
    ranked.sort((a, b) => a.s - b.s || a.label.length - b.label.length);
    options = [...recentHits.map((r): Option => ({ value: r, label: r, kind: "recent" })), ...ranked.slice(0, MAX_OPTIONS - recentHits.length)];
  }
  const shown = open && options.length > 0;

  const choose = (o: Option) => {
    setValue(o.value);
    setOpen(false);
    const input = inputRef.current;
    if (!input) return;
    input.value = o.value;
    input.form?.requestSubmit();
  };

  const onFocus = () => {
    setRecent(readRecent());
    setOpen(true);
    if (!data) loadSuggestions().then(setData);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!options.length) return;
      e.preventDefault();
      setOpen(true);
      const d = e.key === "ArrowDown" ? 1 : -1;
      // -1 is "back in the text box"; moving past either end wraps through it.
      setActive((a) => {
        const next = a + d;
        if (next >= options.length) return -1;
        if (next < -1) return options.length - 1;
        return next;
      });
    } else if (e.key === "Enter" && shown && active >= 0 && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape" && shown) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        name="q"
        type="search"
        className={className}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setActive(-1);
          setOpen(true);
          // Typing can start without a focus event (autofocus, restored focus), so load here too.
          if (!data) loadSuggestions().then(setData);
        }}
        onFocus={onFocus}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" aria-label={typed.length ? "Suggestions" : "Recent searches"} className="search-suggest" hidden={!shown}>
        {typed.length === 0 && shown && (
          <li role="presentation" className="search-suggest-head">
            Recent searches
            <button
              type="button"
              className="search-suggest-clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                writeRecent([]);
                setRecent([]);
              }}
            >
              Clear
            </button>
          </li>
        )}
        {options.map((o, i) => (
          <li
            key={`${o.kind}-${o.value}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className="search-suggest-option"
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(o)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {o.kind === "recent" ? <path d="M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4" /> : o.kind === "subject" ? <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11" /> : <path d="M4 6h16M4 12h16M4 18h10" />}
            </svg>
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.hint && <span className="search-suggest-hint">{o.hint}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}
