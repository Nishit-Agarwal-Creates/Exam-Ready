"use client";

/** Ticks or clears every checkbox named `name` that belongs to the given form. */
export function SelectAll({ form, name = "ids" }: { form: string; name?: string }) {
  const set = (checked: boolean) => {
    document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${name}"][form="${form}"]`).forEach((el) => (el.checked = checked));
  };
  return (
    <span className="inline-flex gap-2">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(true)}>
        Select all
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(false)}>
        Clear
      </button>
    </span>
  );
}
