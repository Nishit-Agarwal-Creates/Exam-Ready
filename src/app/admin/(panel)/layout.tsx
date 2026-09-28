import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s | ExamReady admin" }, robots: { index: false, follow: false } };

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/review", label: "Review queue" },
  { href: "/admin/research", label: "Research" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/papers", label: "Sources" },
  { href: "/admin/import", label: "Import" },
  { href: "/admin/duplicates", label: "Duplicates" },
  { href: "/admin/ai", label: "AI" },
  { href: "/admin/generated", label: "Generated papers" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-ink-deep bg-ink text-white">
        <div className="container-page flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="rounded-sm bg-white/95 px-2 py-0.5" aria-label="Admin dashboard">
              <Logo />
            </Link>
            <span className="text-sm font-bold text-white/80">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn btn-sm border-white/30 bg-transparent text-white hover:bg-white/10">
              View site
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-sm border-white/30 bg-transparent text-white hover:bg-white/10">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <nav aria-label="Admin" className="overflow-x-auto border-b border-rule bg-sheet">
        <div className="container-page min-w-max">
          <NavLinks items={ADMIN_NAV} />
        </div>
      </nav>
      <main id="main" className="container-page flex-1 py-8">
        {children}
      </main>
    </>
  );
}
