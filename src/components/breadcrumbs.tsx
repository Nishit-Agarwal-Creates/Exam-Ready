import Link from "next/link";
import { breadcrumbJsonLd } from "@/lib/site";
import { JsonLd } from "./json-ld";

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(items)} />
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-pencil">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {items.map((it, i) => (
            <li key={it.path} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {i === items.length - 1 ? (
                <span aria-current="page">{it.name}</span>
              ) : (
                <Link href={it.path} className="link">
                  {it.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
