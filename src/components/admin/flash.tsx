export function Flash({ saved, error }: { saved?: string | string[]; error?: string | string[] }) {
  const s = Array.isArray(saved) ? saved[0] : saved;
  const e = Array.isArray(error) ? error[0] : error;
  if (!s && !e) return null;
  return (
    <div className="mb-5 space-y-2">
      {s && s !== "1" && (
        <p role="status" className="rounded-md border border-verified/40 bg-verified-soft px-4 py-2.5 font-bold text-verified">
          {s}
        </p>
      )}
      {s === "1" && (
        <p role="status" className="rounded-md border border-verified/40 bg-verified-soft px-4 py-2.5 font-bold text-verified">
          Saved.
        </p>
      )}
      {e && (
        <p role="alert" className="rounded-md border-2 border-margin/60 bg-margin-soft px-4 py-2.5 font-bold">
          {e}
        </p>
      )}
    </div>
  );
}
