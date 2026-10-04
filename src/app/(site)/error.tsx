"use client";

import Link from "next/link";

/** Errors inside the site keep the header and footer, say what failed and offer a way forward. */
export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page grid min-h-[60dvh] place-items-center py-16" role="alert">
      <div className="sheet max-w-xl p-6 sm:p-8">
        <h1 className="text-[1.8rem]">This page couldn&apos;t load</h1>
        <p className="mt-3 text-pencil">
          The question bank didn&apos;t answer in time, which is usually temporary. Try again in a moment. Tests in progress are saved on this device, so
          nothing you answered is lost.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/my-practice" className="btn btn-secondary">
            My practice
          </Link>
          <Link href="/" className="btn btn-ghost">
            Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
