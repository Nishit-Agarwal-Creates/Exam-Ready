"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="container-page grid min-h-[70dvh] place-items-center py-16">
      <div className="sheet max-w-xl p-8">
        <h1 className="text-[1.9rem]">Something went wrong loading this page</h1>
        <p className="mt-3 text-pencil">
          The question bank didn&apos;t respond. Try again. If you were taking a test, your answers are still saved on this device.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn btn-secondary">
            Go to the homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
