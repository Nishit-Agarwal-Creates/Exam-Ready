/** Wordmark: an answer box with a tick, and the name set in the paper serif. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="shrink-0">
        <rect x="1.5" y="1.5" width="23" height="23" rx="4" fill="#fff" stroke="var(--color-ink)" strokeWidth="2" />
        <path d="M7 13.5l4 4 8-9" fill="none" stroke="var(--color-margin)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-serif text-[1.35rem] font-semibold tracking-[-0.01em] text-graphite">ExamReady</span>
    </span>
  );
}
