import Link from "next/link";
import { breadcrumbJsonLd } from "@/lib/site";
import { JsonLd } from "./json-ld";

/**
 * Where am I? On small screens long trails collapse to "Home / … / parent / current" so they never overflow;
 * the full trail stays in the structured data and on wider screens.
 */
export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  const n = items.length;
  const collapse = n > 4;
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(items)} />
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-pencil">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {items.map((it, i) => {
            const hiddenOnMobile = collapse && i > 0 && i < n - 2;
            return (
              <li key={it.path} className={`${hiddenOnMobile ? "hidden sm:flex" : "flex"} min-w-0 items-center gap-1.5`}>
                {i > 0 && <span aria-hidden="true">/</span>}
                {collapse && i === n - 2 && (
                  <span className="sm:hidden" aria-hidden="true">
                    …&nbsp;/
                  </span>
                )}
                {i === n - 1 ? (
                  <span aria-current="page" className="truncate">
                    {it.name}
                  </span>
                ) : (
                  <Link href={it.path} className="link inline-flex min-h-6 items-center">
                    {it.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
