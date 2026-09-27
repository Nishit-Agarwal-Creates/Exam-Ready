import Link from "next/link";
import { listRecentPapers } from "@/lib/data/papers";
import { MODE_LABELS } from "@/lib/engine/generator";

export const metadata = { title: "Generated papers" };

export default async function GeneratedPapersPage() {
  const rows = await listRecentPapers(100);
  return (
    <div>
      <h1 className="text-[2rem]">Generated papers</h1>
      <p className="mt-2 text-pencil">The 100 most recent practice papers built by students, with how many times each was attempted.</p>
      <div className="panel mt-5 overflow-x-auto">
        <table className="table min-w-[44rem]">
          <thead>
            <tr>
              <th scope="col">Paper</th>
              <th scope="col">Mode</th>
              <th scope="col" className="text-right">
                Marks
              </th>
              <th scope="col" className="text-right">
                Attempts
              </th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-pencil">
                  No papers have been generated yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/paper/${r.id}`} className="font-bold text-ink hover:underline">
                    {r.className} {r.title}
                  </Link>
                  {r.hasDemo && <span className="ml-2 text-sm text-demo">Demo data</span>}
                </td>
                <td>{MODE_LABELS[r.mode].name}</td>
                <td className="num text-right">{r.totalMarks}</td>
                <td className="num text-right">{Number(r.attempts)}</td>
                <td className="whitespace-nowrap">{new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
