/** Shown while a page's data loads: the same structure as a content page, so nothing jumps when it arrives. */
export default function Loading() {
  return (
    <div className="container-page py-8 sm:py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="skeleton h-4 w-56 rounded" />
      <div className="skeleton mt-5 h-10 w-full max-w-xl rounded-lg" />
      <div className="skeleton mt-4 h-4 w-full max-w-2xl rounded" />
      <div className="skeleton mt-2 h-4 w-4/5 max-w-xl rounded" />
      <div className="mt-8 flex flex-wrap gap-2">
        {[7, 5, 6, 4, 8].map((w, i) => (
          <div key={i} className="skeleton h-9 rounded-full" style={{ width: `${w}rem` }} />
        ))}
      </div>
      <div className="mt-8 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sheet p-5 sm:p-6">
            <div className="flex gap-4">
              <div className="skeleton h-6 w-6 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton h-4 w-full rounded" />
                <div className="skeleton h-4 w-11/12 rounded" />
                <div className="skeleton h-4 w-2/3 rounded" />
                <div className="skeleton mt-4 h-6 w-40 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
