import Link from "next/link";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/practice", label: "Practice" },
  { href: "/pyqs", label: "PYQs" },
  { href: "/subjects", label: "Subjects" },
  { href: "/how-it-works", label: "How it works" },
];

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-rule/70 bg-desk/80 backdrop-blur-md supports-[backdrop-filter]:bg-desk/70">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="rounded-md" aria-label="ExamReady home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <NavLinks items={NAV} />
        </nav>
        <div className="flex items-center gap-1.5">
          <Link href="/search" className="btn btn-ghost btn-sm" aria-label="Search questions">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="hidden xl:inline">Search</span>
          </Link>
          <Link href="/my-practice" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            My practice
          </Link>
          <Link href="/practice" className="btn btn-primary btn-sm hidden sm:inline-flex" data-magnetic>
            Build a paper
          </Link>
          <MobileNav items={[...NAV, { href: "/search", label: "Search" }, { href: "/sources", label: "Sources" }, { href: "/my-practice", label: "My practice" }]} />
        </div>
      </div>
    </header>
  );
}
