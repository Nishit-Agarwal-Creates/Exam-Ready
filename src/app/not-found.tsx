import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main id="main" className="container-page grid min-h-dvh place-items-center py-16">
      <div className="sheet sheet-ruled max-w-xl py-10 pr-8">
        <Link href="/" aria-label="ExamReady home">
          <Logo />
        </Link>
        <h1 className="mt-6 text-[2rem]">This page isn&apos;t on the paper</h1>
        <p className="mt-3 text-pencil">The link may be old, or the paper or result may have been removed. Check the address, or start from one of these.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/practice" className="btn btn-primary">
            Build a practice paper
          </Link>
          <Link href="/subjects" className="btn btn-secondary">
            Browse subjects
          </Link>
        </div>
      </div>
    </main>
  );
}
