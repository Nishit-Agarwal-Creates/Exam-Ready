import Link from "next/link";
import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "Practise",
    links: [
      { href: "/practice", label: "Build a paper" },
      { href: "/pyqs", label: "Browse questions" },
      { href: "/my-practice", label: "My practice" },
    ],
  },
  {
    title: "ICSE",
    links: [
      { href: "/icse/class-10", label: "Class 10" },
      { href: "/icse/class-9", label: "Class 9" },
      { href: "/icse/class-8", label: "Class 8" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/how-it-works#sources", label: "Question sources" },
      { href: "/admin", label: "Admin sign-in" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t border-rule bg-sheet">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-[0.95rem] text-pencil">
            Verified questions are backed by their listed source. Anything not verified is labelled, and AI-generated questions are never shown as past-paper
            questions.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="font-sans text-[0.95rem] font-bold text-graphite">{col.title}</h2>
            <ul className="mt-3 space-y-1">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-9 items-center text-[0.95rem] text-pencil hover:text-ink hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-rule">
        <div className="container-page flex flex-col gap-2 py-5 text-sm text-pencil sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} ExamReady. Not affiliated with CISCE or any examination board.</p>
          <p>This build contains demo data, which is labelled wherever it appears.</p>
        </div>
      </div>
    </footer>
  );
}
