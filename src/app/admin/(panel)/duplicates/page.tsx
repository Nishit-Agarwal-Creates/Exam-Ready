import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { StatusStamp } from "@/components/provenance";
import { listDuplicateGroups } from "@/lib/data/admin";
import { citation } from "@/lib/provenance";
import { setCanonicalAction } from "../../actions";

export const metadata = { title: "Duplicates" };

export default async function DuplicatesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const groups = await listDuplicateGroups();
  return (
    <div>
      <Flash saved={sp.saved} error={sp.error} />
      <h1 className="text-[2rem]">Duplicates</h1>
      <p className="prose-width mt-2 text-pencil">
        Questions that are the same question in different sources (for example several sets of one year&apos;s paper, or a repeat in a later year) share a
        canonical question. Frequency and trends count each group once. Split a question out if it was matched wrongly, or link one yourself.
      </p>

      <form action={setCanonicalAction} className="panel mt-5 flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <input type="hidden" name="back" value="/admin/duplicates" />
        <div>
          <label htmlFor="d-q" className="field-label">
            Question id
          </label>
          <input id="d-q" name="questionId" inputMode="numeric" className="input num w-32" required />
        </div>
        <div>
          <label htmlFor="d-c" className="field-label">
            Is a duplicate of question id
          </label>
          <input id="d-c" name="canonicalId" inputMode="numeric" className="input num w-40" placeholder="blank = not a duplicate" />
        </div>
        <button type="submit" className="btn btn-secondary">
          Save link
        </button>
      </form>

      <p className="mt-6 font-bold">
        <span className="num">{groups.length}</span> duplicate groups
      </p>
      <ul className="mt-3 space-y-4">
        {groups.map((g) => (
          <li key={g.canonicalId} className="panel rounded-2xl p-4">
            <p className="text-sm text-pencil">Canonical question #{g.canonicalId}</p>
            <ul className="mt-2 divide-y divide-rule">
              {g.members.map((m) => (
                <li key={m.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/admin/questions/${m.id}`} className="font-bold text-ink hover:underline">
                      #{m.id}
                    </Link>{" "}
                    <span className="line-clamp-2 inline text-[0.95rem]">{m.text}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[0.85rem] text-pencil">
                      <StatusStamp status={m.status} />
                      {m.sources.map((s) => (
                        <span key={s.paperId}>{citation(s)}</span>
                      ))}
                    </span>
                  </div>
                  {m.canonical !== null && (
                    <form action={setCanonicalAction}>
                      <input type="hidden" name="questionId" value={m.id} />
                      <input type="hidden" name="canonicalId" value="" />
                      <input type="hidden" name="back" value="/admin/duplicates" />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        Not a duplicate
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
