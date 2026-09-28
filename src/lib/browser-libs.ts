/**
 * Heavy browser-only libraries (PDF writing, PDF reading, OCR) are loaded on demand from the
 * jsDelivr CDN at pinned versions. The bundler is told to ignore these imports, so none of them
 * end up in the Cloudflare Worker bundle or in any page's initial JavaScript.
 * The npm packages are kept as devDependencies for their TypeScript types.
 */
type PdfLib = typeof import("pdf-lib");
type PdfJs = typeof import("pdfjs-dist");
type Tesseract = typeof import("tesseract.js");

export const PDFJS_VERSION = "4.10.38";

const URLS = {
  pdfLib: "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm",
  fontkit: "https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/+esm",
  pdfjs: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`,
  pdfjsWorker: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
  tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js",
};

function load<T>(url: string): Promise<T> {
  return import(/* turbopackIgnore: true */ /* webpackIgnore: true */ url) as Promise<T>;
}

export const loadPdfLib = () => load<PdfLib>(URLS.pdfLib);

export async function loadFontkit(): Promise<unknown> {
  const m = await load<{ default?: unknown }>(URLS.fontkit);
  return m.default ?? m;
}

export async function loadPdfJs(): Promise<PdfJs> {
  const m = await load<PdfJs>(URLS.pdfjs);
  m.GlobalWorkerOptions.workerSrc = URLS.pdfjsWorker;
  return m;
}

export async function loadTesseract(): Promise<Tesseract> {
  const m = await load<Tesseract & { default?: Tesseract }>(URLS.tesseract);
  return (m.default ?? m) as Tesseract;
}
