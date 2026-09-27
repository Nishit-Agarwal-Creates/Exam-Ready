import Link from "next/link";

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages))].sort((a, b) => a - b);
  return (
    <nav aria-label="Pages" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} className="btn btn-secondary btn-sm" rel="prev">
          Previous
        </Link>
      )}
      {nums.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && p - nums[i - 1] > 1 && <span className="text-pencil">…</span>}
          <Link href={href(p)} aria-current={p === page ? "page" : undefined} className={`btn btn-sm num ${p === page ? "btn-primary" : "btn-ghost"}`}>
            {p}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} className="btn btn-secondary btn-sm" rel="next">
          Next
        </Link>
      )}
    </nav>
  );
}
