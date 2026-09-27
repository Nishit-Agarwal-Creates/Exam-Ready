"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { forgetAttempt, readHistory } from "@/lib/history";
import { formatDuration } from "@/lib/text";

type Row = {
  id: string;
  paperId: string;
  submittedAt: string | null;
  maxScore: number;
  autoScore: number | null;
  selfScore: number | null;
  timeUsedSeconds: number;
  title: string;
  mode: string;
  hasDemo: boolean;
};

export function MyPractice() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ids = readHistory();
    const request: Promise<Row[]> = ids.length
      ? fetch(`/api/attempts?ids=${encodeURIComponent(ids.join(","))}`).then((r) => (r.ok ? (r.json() as Promise<Row[]>) : Promise.reject()))
      : Promise.resolve([]);
    request
      .then((data) => setRows(ids.map((id) => data.find((d) => d.id === id)).filter((r): r is Row => Boolean(r))))
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="field-error mt-8">Your history couldn&apos;t be loaded. Check your connection and refresh the page.</p>;
  if (rows === null) return <p className="mt-8 text-pencil">Loading your tests…</p>;
  if (rows.length === 0) {
    return (
      <div className="sheet mt-8 max-w-2xl p-6 sm:p-8">
        <h2 className="text-[1.5rem]">No tests yet</h2>
        <p className="mt-2 text-pencil">Build a paper and take it online. Your results will be listed here.</p>
        <Link href="/practice" className="btn btn-primary mt-5">
          Build a practice paper
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 overflow-x-auto sheet">
      <table className="table">
        <caption className="sr-only">Submitted tests</caption>
        <thead>
          <tr>
            <th scope="col">Paper</th>
            <th scope="col">Submitted</th>
            <th scope="col">Score</th>
            <th scope="col">Time</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const score = (r.autoScore ?? 0) + (r.selfScore ?? 0);
            return (
              <tr key={r.id}>
                <td>
                  <Link href={`/results/${r.id}`} className="font-bold text-ink hover:underline">
                    {r.title}
                  </Link>
                  {r.hasDemo && <span className="ml-2 text-sm text-demo">Demo data</span>}
                </td>
                <td className="whitespace-nowrap">{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "–"}</td>
                <td className="num whitespace-nowrap">
                  {score}/{r.maxScore}
                  {r.selfScore === null && <span className="block text-sm text-pencil">written answers unmarked</span>}
                </td>
                <td className="whitespace-nowrap">{formatDuration(r.timeUsedSeconds)}</td>
                <td className="whitespace-nowrap text-right">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      forgetAttempt(r.id);
                      setRows((prev) => prev?.filter((x) => x.id !== r.id) ?? null);
                    }}
                  >
                    Remove from list
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
