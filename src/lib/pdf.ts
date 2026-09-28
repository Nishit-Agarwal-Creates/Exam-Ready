/**
 * Client-side PDF export. pdf-lib (and fontkit) are loaded on demand, so they never ship with the
 * initial page and never run on the Worker. DejaVu Serif is embedded (subset) so subscripts,
 * superscripts, arrows, √, π and other symbols print correctly; if the font can't be loaded the
 * built-in Times fonts are used with a symbol fallback table.
 */
import type { PaperView } from "@/lib/data/papers";
import { answerAddsInfo } from "@/lib/answer-text";
import { loadFontkit, loadPdfLib } from "@/lib/browser-libs";
import { citation, isRealVerifiedPyq } from "@/lib/provenance";

const LETTERS = ["a", "b", "c", "d", "e", "f"];



const REPLACEMENTS: Record<string, string> = {
  "→": "->",
  "⟶": "->",
  "←": "<-",
  "⇌": "<=>",
  "↔": "<->",
  "↑": "(g)^",
  "↓": "(s)v",
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "≈": "~",
  "∛": "cbrt",
  "π": "(pi)",
  "∈": " in ",
  "∉": " not in ",
  "⇒": " => ",
  "⟹": " => ",
  "⇔": " <=> ",
  "∪": " U ",
  "∩": " n ",
  "⊂": " subset of ",
  "∑": "sum ",
  "√": "sqrt",
  "∫": "integral ",
  "∓": "-/+",
  "ℝ": "R",
  "ℕ": "N",
  "ℤ": "Z",
  "ℚ": "Q",
  "θ": "theta",
  "Δ": "delta ",
  "δ": "delta",
  "λ": "lambda",
  "α": "alpha",
  "β": "beta",
  "γ": "gamma",
  "ω": "omega",
  "Ω": " ohm",
  "μ": "µ",
  "ρ": "rho",
  "η": "eta",
  "σ": "sigma",
  "φ": "phi",
  "∠": "angle ",
  "∴": "therefore",
  "∵": "because",
  "∞": "infinity",
  "′": "'",
  "″": '"',
  "₹": "Rs. ",
  "⁺": "+",
  "⁻": "-",
  "₊": "+",
  "₋": "-",
  "⁄": "/",
  "−": "-",
  "∆": "delta ",
  "∝": " proportional to ",
  "⊥": " perpendicular ",
  "∥": " parallel ",
  "≅": " congruent to ",
  "∼": "~",
  "△": "triangle ",
  "□": "",
};

function sanitize(text: string, charset: Set<number>): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    if (ch === "\n") {
      out += "\n";
      continue;
    }
    if (ch === "\t") {
      out += " ";
      continue;
    }
    // Arrow extension strokes (⎯⎯→) print as a single arrow.
    if (ch === "⎯" || ch === "⏤") continue;
    // Keep anything the embedded font can draw.
    if (charset.has(cp)) {
      out += ch;
      continue;
    }
    if (cp >= 0x2080 && cp <= 0x2089) {
      out += String(cp - 0x2080);
      continue;
    }
    const sup = "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(ch);
    if (sup >= 0) {
      out += `^${sup}`;
      continue;
    }
    if (REPLACEMENTS[ch] !== undefined) {
      out += REPLACEMENTS[ch];
      continue;
    }
    out += "?";
  }
  return out;
}

export async function downloadPaperPdf(paper: PaperView, withAnswers: boolean): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const doc = await PDFDocument.create();
  let unicode: { regular: ArrayBuffer; bold: ArrayBuffer; sans: ArrayBuffer } | null = null;
  try {
    const fontkit = (await loadFontkit()) as Parameters<typeof doc.registerFontkit>[0];
    const load = async (f: string) => {
      const r = await fetch(`/fonts/${f}`);
      if (!r.ok) throw new Error(f);
      return r.arrayBuffer();
    };
    const [regular, bold, sansFont] = await Promise.all([load("DejaVuSerif.ttf"), load("DejaVuSerif-Bold.ttf"), load("DejaVuSans.ttf")]);
    doc.registerFontkit(fontkit);
    unicode = { regular, bold, sans: sansFont };
  } catch {
    unicode = null; // fall back to the standard fonts
  }
  doc.setTitle(`${paper.board.name} ${paper.cls.name} ${paper.subject.name} practice paper`);
  doc.setAuthor("ExamReady");
  doc.setCreator("ExamReady");
  const regular = unicode ? await doc.embedFont(unicode.regular, { subset: true }) : await doc.embedFont(StandardFonts.TimesRoman);
  const bold = unicode ? await doc.embedFont(unicode.bold, { subset: true }) : await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = unicode ? regular : await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = unicode ? await doc.embedFont(unicode.sans, { subset: true }) : await doc.embedFont(StandardFonts.Helvetica);
  const charset = new Set(regular.getCharacterSet());
  const s = (t: string) => sanitize(t, charset);

  const W = 595.28,
    H = 841.89,
    M = 56,
    numX = M,
    textX = M + 26,
    marksW = 34,
    textW = W - M - textX - marksW;
  const ink = rgb(0.1, 0.12, 0.14);
  const grey = rgb(0.38, 0.4, 0.43);

  let page = doc.addPage([W, H]);
  let y = H - M;

  type Font = typeof regular;
  const wrap = (text: string, font: Font, size: number, width: number): string[] => {
    const lines: string[] = [];
    for (const para of s(text).split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of words) {
        const trial = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(trial, size) <= width) {
          line = trial;
          continue;
        }
        if (line) lines.push(line);
        // Break a single word that is wider than the line.
        let w = word;
        while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
          let cut = w.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
          lines.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        line = w;
      }
      lines.push(line);
    }
    return lines;
  };

  const ensure = (needed: number) => {
    if (y - needed < M + 20) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };
  const text = (t: string, x: number, size: number, font: Font = regular, color = ink) => page.drawText(s(t), { x, y, size, font, color });
  const centered = (t: string, size: number, font: Font = regular, color = ink) => {
    const str = s(t);
    page.drawText(str, { x: (W - font.widthOfTextAtSize(str, size)) / 2, y, size, font, color });
  };
  const rule = (thickness = 0.8) => page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness, color: ink });

  // Header: the ExamReady mark (vector, same geometry as components/logo.tsx) and name
  {
    const k = 14 / 32; // 32-unit mark drawn at 14pt
    const top = y + 10;
    page.drawSvgPath("M9 0.5H23A8.5 8.5 0 0 1 31.5 9V23A8.5 8.5 0 0 1 23 31.5H9A8.5 8.5 0 0 1 0.5 23V9A8.5 8.5 0 0 1 9 0.5Z", {
      x: M,
      y: top,
      scale: k,
      color: rgb(0.106, 0.145, 0.627),
    });
    page.drawSvgPath("M10 9.5H22M10 22.5H22M10 9.5V22.5", { x: M, y: top, scale: k, borderColor: rgb(1, 1, 1), borderWidth: 2.8 * k * 2.2 });
    page.drawSvgPath("M10 16H13.4L16.3 13L18.6 14.6L21.2 11.3", { x: M, y: top, scale: k, borderColor: rgb(0.435, 0.89, 1), borderWidth: 2.6 * k * 2.2 });
    page.drawCircle({ x: M + 22.9 * k, y: top - 10.1 * k, size: 2.3 * k, color: rgb(1, 0.353, 0.416) });
  }
  text("ExamReady", M + 19, 9, sans, grey);
  y -= 22;
  centered(`${paper.board.name} ${paper.cls.name} ${paper.subject.name}`, 17, bold);
  y -= 18;
  for (const l of wrap(paper.chapterNames.length ? paper.chapterNames.join(", ") : "Full syllabus", regular, 11.5, W - 2 * M)) {
    centered(l, 11.5);
    y -= 14;
  }
  y -= 6;
  text(`Maximum Marks: ${paper.totalMarks}`, M, 11.5, bold);
  const timeStr = `Time allowed: ${paper.durationMinutes} minutes`;
  page.drawText(timeStr, { x: W - M - bold.widthOfTextAtSize(timeStr, 11.5), y, size: 11.5, font: bold, color: ink });
  y -= 10;
  rule(1.2);
  y -= 16;

  if (paper.hasDemo) {
    const demo = "Includes AI practice questions: written by AI, not from any exam, not previous-year questions.";
    page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 18, color: rgb(1, 0.94, 0.82), borderColor: rgb(0.48, 0.24, 0), borderWidth: 0.8 });
    text(demo, M + 6, 9.5, sans, rgb(0.48, 0.24, 0));
    y -= 24;
  }

  text("General instructions", M, 11, bold);
  y -= 14;
  const instructions = [
    "Attempt all questions. The marks for each question are shown in brackets [ ].",
    ...(paper.mode === "EXAM_SIMULATION" ? ["Section A has short questions. Section B has longer questions."] : []),
    "Show your working for numerical questions.",
  ];
  for (const ins of instructions) {
    for (const [i, l] of wrap(ins, italic, 10.5, W - 2 * M - 12).entries()) {
      text(i === 0 ? `- ${l}` : `  ${l}`, M, 10.5, italic);
      y -= 13;
    }
  }
  y -= 8;

  // Questions
  const sections = paper.mode === "EXAM_SIMULATION" ? ["A", "B"] : [""];
  let n = 0;
  const numbers = new Map<number, number>();
  for (const sec of sections) {
    const items = paper.items.filter((i) => i.section === sec);
    if (!items.length) continue;
    if (sec) {
      ensure(40);
      y -= 6;
      const label = `SECTION ${sec}`;
      const secMarks = `(${items.reduce((t, i) => t + i.marks, 0)} marks)`;
      centered(`${label} ${secMarks}`, 12, bold);
      y -= 20;
    }
    for (const item of items) {
      n++;
      numbers.set(item.position, n);
      const q = item.question;
      const lines = wrap(q.text, regular, 11.5, textW);
      const optLines: string[] = [];
      if (q.options) {
        const short = q.options.every((o) => regular.widthOfTextAtSize(s(o), 11) < textW / 2 - 30);
        if (short) {
          for (let i = 0; i < q.options.length; i += 2) optLines.push(`${i}`);
        } else {
          q.options.forEach((o, i) => wrap(`(${LETTERS[i]}) ${o}`, regular, 11, textW - 10).forEach((l) => optLines.push(`L${l}`)));
        }
      }
      const tag = isRealVerifiedPyq(q)
        ? citation(q.sources.find((x) => !x.isDemo && x.paperType === "BOARD_EXAM") ?? q.sources[0])
        : q.sourceType === "AI_SUPPLEMENTARY"
          ? "AI practice question"
          : q.sourceType === "OFFICIAL_SAMPLE"
            ? "Official sample question"
            : null;
      const figureSrc = q.hasFigure ? q.sources.find((x) => !x.isDemo) : undefined;
      const figureNote = q.hasFigure ? `[Figure/table in the source paper${figureSrc?.pageNumber ? `, page ${figureSrc.pageNumber}` : ""}]` : null;
      const blockH = lines.length * 14.5 + optLines.length * 14 + (tag ? 12 : 0) + (figureNote ? 13 : 0) + 12;
      ensure(Math.min(blockH, 200));
      text(`${n}.`, numX, 11.5, bold);
      const marksStr = `[${item.marks}]`;
      page.drawText(marksStr, { x: W - M - bold.widthOfTextAtSize(marksStr, 11.5), y, size: 11.5, font: bold, color: ink });
      for (const l of lines) {
        ensure(14.5);
        text(l, textX, 11.5);
        y -= 14.5;
      }
      if (q.options) {
        const short = optLines.length && !optLines[0].startsWith("L");
        for (const l of optLines) {
          ensure(14);
          if (short) {
            const i = Number(l);
            text(`(${LETTERS[i]}) ${q.options[i]}`, textX + 8, 11);
            if (q.options[i + 1] !== undefined) text(`(${LETTERS[i + 1]}) ${q.options[i + 1]}`, textX + 8 + textW / 2, 11);
          } else {
            text(l.slice(1), textX + 8, 11);
          }
          y -= 14;
        }
      }
      if (figureNote) {
        ensure(13);
        text(figureNote, textX, 9.5, italic, grey);
        y -= 13;
      }
      if (tag) {
        ensure(12);
        text(tag, textX, 8.5, italic, grey);
        y -= 12;
      }
      y -= 10;
    }
  }

  // Answer key
  if (withAnswers) {
    page = doc.addPage([W, H]);
    y = H - M;
    centered("Answer key", 15, bold);
    y -= 12;
    rule();
    y -= 18;
    for (const item of paper.items) {
      const q = item.question;
      if (!q.answer) continue;
      const num = numbers.get(item.position) ?? item.position;
      let keyLine = "";
      const key = q.answer.key;
      if (key && "correctOption" in key && q.options) keyLine = `(${LETTERS[key.correctOption]}) ${q.options[key.correctOption]}`;
      else if (key && "accepted" in key) keyLine = key.accepted.join(" / ");
      else if (key && "value" in key) keyLine = `${key.value}${key.unit ? ` ${key.unit}` : ""}`;
      const body = [keyLine, answerAddsInfo(keyLine, q.answer.text) ? q.answer.text : ""].filter(Boolean).join("\n");
      const origin =
        q.answerSource === "OFFICIAL_SCHEME" ? "Official marking scheme" : q.answerSource === "AI" ? "Model answer written by AI" : q.answerSource === "EDITOR" ? "Model answer" : "";
      const imageNote = q.extractionIssues.some((i) => /image/i.test(i) && /(scheme|answer)/i.test(i))
        ? " (Parts of the official answer are images in the marking scheme and are not reproduced here.)"
        : "";
      const lines = wrap(
        body ? `${origin ? `${origin}: ` : ""}${body}${imageNote}` : "No official answer has been published for this question.",
        regular,
        10.5,
        textW + marksW,
      );
      ensure(Math.min(lines.length * 13 + 10, 160));
      text(`${num}.`, numX, 10.5, bold);
      for (const l of lines) {
        ensure(13);
        text(l, textX, 10.5);
        y -= 13;
      }
      y -= 8;
    }
  }

  // Footers
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const footer = `Page ${i + 1} of ${pages.length}`;
    p.drawText(footer, { x: W - M - sans.widthOfTextAtSize(footer, 8.5), y: 30, size: 8.5, font: sans, color: grey });
    const left = paper.hasDemo ? "ExamReady practice paper. Includes AI practice questions." : "ExamReady practice paper";
    p.drawText(left, { x: M, y: 30, size: 8.5, font: sans, color: grey });
  });

  const bytes = await doc.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `examready-${paper.cls.slug}-${paper.subject.slug}-${paper.totalMarks}-marks${withAnswers ? "-with-answers" : ""}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
