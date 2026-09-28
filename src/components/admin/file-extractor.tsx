"use client";

import { useRef, useState } from "react";
import { loadPdfJs, loadTesseract } from "@/lib/browser-libs";

/**
 * Client-side text extraction for the import pipeline. The file is read in the browser and never
 * uploaded: only the extracted text, the method used and OCR confidence are submitted.
 *
 *   PDF with a text layer → pdf.js text extraction (page markers kept)
 *   Scanned PDF / image    → Tesseract.js OCR (free, runs in the browser), with per-page confidence
 */
const MAX_BYTES = 25 * 1024 * 1024;

type Result = { text: string; method: "PDF_TEXT_LAYER" | "OCR"; pages: number; ocrMean: number | null; pageConfidence: Record<number, number> };

async function sniff(file: File): Promise<"pdf" | "png" | "jpeg" | "webp" | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const hex = [...head].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.startsWith("25504446")) return "pdf"; // %PDF
  if (hex.startsWith("89504e47")) return "png";
  if (hex.startsWith("ffd8ff")) return "jpeg";
  if (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250") return "webp";
  return null;
}

async function ocrCanvasOrImage(source: HTMLCanvasElement | File, onProgress: (p: number) => void) {
  const { createWorker } = await loadTesseract();
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(source);
    return { text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}

export function FileExtractor({ textareaId }: { textareaId: string }) {
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const scannedRef = useRef<File | null>(null);
  const [scanned, setScanned] = useState(false);

  function fill(r: Result) {
    setResult(r);
    const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    if (ta) {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      set.call(ta, r.text);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  async function runOcrOnPdf(file: File) {
    setBusy(true);
    setError("");
    try {
      const pdfjs = await loadPdfJs();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const parts: string[] = [];
      const conf: Record<number, number> = {};
      const pages = Math.min(doc.numPages, 60);
      for (let i = 1; i <= pages; i++) {
        setStatus(`OCR on page ${i} of ${pages}…`);
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        const r = await ocrCanvasOrImage(canvas, (p) => setStatus(`OCR on page ${i} of ${pages}: ${Math.round(p * 100)}%`));
        conf[i] = r.confidence;
        parts.push(`=== Page ${i} ===\n${r.text}`);
      }
      const mean = Object.values(conf).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(conf).length);
      fill({ text: parts.join("\n"), method: "OCR", pages, ocrMean: mean, pageConfidence: conf });
      setStatus(`OCR finished on ${pages} page${pages === 1 ? "" : "s"}. Mean confidence ${Math.round(mean)}%. Low-confidence pages will be flagged for review.`);
    } catch {
      setError("OCR failed. The OCR engine is downloaded from a public CDN the first time; check your connection and try again.");
    }
    setBusy(false);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setStatus("");
    setResult(null);
    setScanned(false);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("That file is larger than 25 MB. Split the paper or compress the file.");
      return;
    }
    const kind = await sniff(file);
    if (!kind) {
      setError("Only PDF, PNG, JPEG or WebP files can be read. The file's contents don't match any of these.");
      return;
    }
    setBusy(true);
    try {
      if (kind === "pdf") {
        setStatus("Reading the PDF text layer…");
        const pdfjs = await loadPdfJs();
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const parts: string[] = [];
        let chars = 0;
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          let text = "";
          for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
            text += (item.str ?? "") + (item.hasEOL ? "\n" : " ");
          }
          chars += text.trim().length;
          parts.push(`=== Page ${i} ===\n${text.trim()}`);
        }
        if (chars < doc.numPages * 40) {
          scannedRef.current = file;
          setScanned(true);
          setStatus(`This PDF has little or no text layer (${chars} characters across ${doc.numPages} pages). It's probably scanned.`);
        } else {
          fill({ text: parts.join("\n"), method: "PDF_TEXT_LAYER", pages: doc.numPages, ocrMean: null, pageConfidence: {} });
          setStatus(`Read the text layer of ${doc.numPages} pages. Review the text below before extracting questions.`);
        }
      } else {
        setStatus("Running OCR on the image…");
        const r = await ocrCanvasOrImage(file, (p) => setStatus(`Running OCR: ${Math.round(p * 100)}%`));
        fill({ text: `=== Page 1 ===\n${r.text}`, method: "OCR", pages: 1, ocrMean: r.confidence, pageConfidence: { 1: r.confidence } });
        setStatus(`OCR finished. Confidence ${Math.round(r.confidence)}%.${r.confidence < 70 ? " That's low: check every question against the image." : ""}`);
      }
    } catch {
      setError("The file couldn't be read. It may be damaged, password-protected or not a real PDF/image.");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-dashed border-rule-strong bg-desk/50 p-4">
      <label htmlFor="source-file" className="field-label">
        Read text from a file (optional)
      </label>
      <input id="source-file" type="file" accept=".pdf,application/pdf,image/png,image/jpeg,image/webp" onChange={onFile} disabled={busy} className="block text-[0.95rem]" />
      <p className="field-hint mt-1">PDF, PNG, JPEG or WebP up to 25 MB. The file stays on your computer; only the extracted text is sent.</p>
      {scanned && (
        <button type="button" className="btn btn-secondary btn-sm mt-3" disabled={busy} onClick={() => scannedRef.current && runOcrOnPdf(scannedRef.current)}>
          Run OCR on this PDF
        </button>
      )}
      {status && (
        <p className="mt-2 text-[0.92rem]" aria-live="polite">
          {status}
        </p>
      )}
      {error && (
        <p className="field-error mt-2" role="alert">
          {error}
        </p>
      )}
      <input type="hidden" name="extractionMethod" value={result?.method ?? "PASTED_TEXT"} />
      <input type="hidden" name="ocrConfidence" value={result?.ocrMean ?? ""} />
      <input type="hidden" name="pageConfidence" value={JSON.stringify(result?.pageConfidence ?? {})} />
    </div>
  );
}
