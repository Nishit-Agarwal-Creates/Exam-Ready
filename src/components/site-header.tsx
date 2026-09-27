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
    <header className="no-print sticky top-0 z-40 border-b border-rule bg-desk/95 backdrop-blur supports-[backdrop-filter]:bg-desk/85">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="rounded-sm" aria-label="ExamReady home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <NavLinks items={NAV} />
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/my-practice" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            My practice
          </Link>
          <Link href="/practice" className="btn btn-primary btn-sm hidden sm:inline-flex">
            Build a paper
          </Link>
          <MobileNav items={[...NAV, { href: "/my-practice", label: "My practice" }]} />
        </div>
      </div>
    </header>
  );
}
