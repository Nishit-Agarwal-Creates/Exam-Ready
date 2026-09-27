import Link from "next/link";

/** Tabs linking the three subject pages together (internal linking for students and crawlers). */
export function SubjectNav({ base, current }: { base: string; current: "overview" | "chapter-wise" | "pyq" }) {
  const tabs = [
    { key: "overview", href: base, label: "Overview" },
    { key: "chapter-wise", href: `${base}/chapter-wise`, label: "Chapter-wise questions" },
    { key: "pyq", href: `${base}/pyq`, label: "Previous-year questions" },
  ] as const;
  return (
    <nav aria-label="Subject sections" className="mt-6 overflow-x-auto border-b border-rule">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={t.key === current ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 px-3 font-bold ${
                t.key === current ? "border-margin text-ink" : "border-transparent text-pencil hover:text-graphite"
              }`}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
