import { Fragment } from "react";
import { parseMath } from "@/lib/math-markup";

/** Renders question text with the pack notation markup (^ and _{}) as real superscripts and subscripts. */
export function MathText({ text }: { text: string }) {
  if (!/[\^_]/.test(text)) return <>{text}</>;
  return (
    <>
      {parseMath(text).map((p, i) =>
        p.kind === "sup" ? <sup key={i}>{p.value}</sup> : p.kind === "sub" ? <sub key={i}>{p.value}</sub> : <Fragment key={i}>{p.value}</Fragment>,
      )}
    </>
  );
}
