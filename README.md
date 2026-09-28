# ExamReady

**Prepare from real exam questions.**

ExamReady builds practice papers from previous-year questions (PYQs) that trace back to official board papers, lets students take them as timed online tests or print them, and shows exactly where every question came from. It covers ICSE/ISC and CBSE, Classes 6 to 12, with honest coverage: every page shows what is actually verified.

The rules the whole product is built around:

- A question is only shown as a **Verified PYQ** when it is linked to a stored board-exam paper with a year **and** an editor has checked it against that document.
- Extraction is not verification, and AI output is never provenance.
- Nothing is invented: no years, sources, answer keys, statistics or coverage. Where data doesn't exist, the UI says so.

---

## Quick start

Requirements: Node.js 20.9+ (tested on Node 24) and npm. No Cloudflare account or API key is needed for local development.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The first `npm run dev` does three things:

- creates `.dev.vars` with a random admin password, and prints it,
- applies the database migrations to a local D1 database,
- loads the AI-written practice bank and the official CBSE and CISCE source packs.

The admin area is at `/admin`.

```bash
npm run build      # production build
npm test           # unit tests (engine, grading, ingestion, provenance rules)
npm run lint
npm run typecheck
npm run db:reset   # reload demo data and return every official question to "pending review" (local only)
```

---

## What's in the bank

Everything below comes from documents the boards publish themselves. **Every official question is imported as "pending review"**: it isn't shown to students, used in papers or counted as a PYQ until an editor has checked it against the linked PDF in `/admin/review`.

| Board and class | Subject | Board exam papers (PYQ candidates) | Official sample / specimen |
| --- | --- | --- | --- |
| CBSE Class 10 | Science | 2026 (31/2/1, 31/2/2), 2025 (31/1/1), 2024 (31/4/1), 2023 (31/2/1) | 2025-26 SQP |
| CBSE Class 10 | Mathematics Standard | 2025 (30/1/1) | 2025-26 SQP |
| CBSE Class 10 | Social Science | 2026 (32/4/1), 2025 (32/1/1) | 2025-26 SQP |
| CBSE Class 12 | Physics | 2026 (55/1/1), 2025 (55/4/1) | 2025-26 SQP |
| CBSE Class 12 | Chemistry | 2026 (56/1/1), 2025 (56/4/1) | 2025-26 SQP |
| CBSE Class 12 | Biology | 2026 (57/1/1), 2025 (57/4/1) | 2025-26 SQP |
| CBSE Class 12 | Mathematics | 2026 (65/1/1) | 2025-26 SQP |
| ICSE Class 10 | Physics, Chemistry, Biology | none published by CISCE | 2027 and 2026 specimens |
| ICSE Class 10 | Mathematics, History & Civics, Geography | none published by CISCE | 2027 specimens |
| ISC Class 12 | Physics, Chemistry, Biology, Mathematics | none published by CISCE | 2027 specimens |

In numbers: 35 source documents (15 board exam papers, 20 sample/specimen papers), 1,694 extracted questions (643 from board papers, 1,051 from samples/specimens), of which 1,562 carry the official marking-scheme answer. 1,688 load into the database; 6 are held back because no syllabus chapter fits them (an editor maps them). 61 duplicate links (for example the same question in two 2026 sets, or reused between the 2026 and 2027 ICSE specimens) make repeats count once.

The ICSE Classes 8–10 practice bank (428 questions) was written by AI. It is stamped **AI practice** everywhere and is never counted or presented as a previous-year question.

Source packs live in `src/data/sources/*.json` (format in `src/data/sources/FORMAT.md`). Each records the source URL and file inside the archive, the year, Q.P. code, set and series, the PDF page of every question, marks and where they came from, figures that couldn't be reproduced, extraction confidence and notes, the printed cognitive level (CISCE specimens), and official answers. Chapter mappings are suggestions until confirmed.

```bash
node scripts/check-sources.mjs                       # validate every pack (structure, chapters, answers, marks)
node scripts/check-sources.mjs --chapters cbse 12 physics   # list valid chapter slugs
npm run db:sources:build                             # write drizzle/seed/sources.sql (idempotent)
```

What was found, imported and blocked is recorded in `src/data/source-registry.json` and shown in `/admin/research`.

---

## Features

**Student side**

- **Smart search** (`/search`, also on the homepage): type "Class 10 CBSE electricity", "ICSE Class 10 quadratic equations", "2026 Science QP 31/2/1", "questions on heredity" or "repeated questions chemical reactions". The query is read against the real catalogue (board, class, subject, chapter, year, Q.P. code, question number, marks, type, "repeated") and the recognised filters are shown as chips; anything else is matched word by word.
- **PYQ hubs** (`/pyq/[board]/[class]/[subject]/[chapter]`): crawlable pages of verified PYQs, 10 per page, with year filters, chapter chips, trend tags ("3 exam years", "2 sets, 2026", "Recent: 2026") and actions (view question, view source, find similar, practise this chapter). Empty hubs say "source collection in progress" and are `noindex`.
- **PYQ explorer** (`/pyqs`): board → class → subject → year → paper → questions, with filters for year, chapter, marks, type, difficulty (practice questions only), source and repeated questions.
- **Question pages** (`/questions/[id]`): the full provenance panel, the official answer, other papers the same question appeared in, and similar questions from the same chapter.
- **Coverage** (`/coverage`): verified PYQs, official samples, AI practice, questions awaiting review, source papers and exam years, by board, class, subject and chapter, counted live.
- **Paper builder** (`/practice`):
  - eight modes: PYQ only, Recent PYQs, Most repeated PYQs, PYQ priority, Exam simulation, PYQ + official sample, Practice mix, AI practice;
  - full-syllabus or chapter-wise scope; marks, time and difficulty;
  - refine by question type, PYQ exam-year range and "leave out questions that need a figure"; duplicates across sets are always used once;
  - live year-by-year coverage before you build. The paper records the filters it used.

  Non-PYQ questions only fill gaps if the student ticks "allow". The generation dialog replays the steps the engine actually ran.
- **Online test**: timer, palette, mark for review, autosave and resume, submit confirmation, auto-submit, and figure notices linking to the source page. Choosing an answer gives a short tactile response; it never hints at correctness.
- **Results**: score, accuracy, attempted, unanswered, marked for review and time used; breakdowns by chapter, type, section and source; a revision list. Questions without an official key are self-marked, and no answer is invented. There is no rank or percentile.
- **PDF**: DejaVu Unicode fonts embedded, the ExamReady mark in the header, a citation for each verified PYQ, figure notes pointing to the source page, and an answer key that labels each answer as official scheme, editor or AI.
- **Sources** (`/sources`): every document, grouped by board and class, filterable by board and type, with authority, year, code, questions imported, verification status, usage note and access date.
- **Trends** on every subject page, computed from verified data only. "Repeated" means the same question appeared in two or more *exam years*; several sets of one year are reported separately ("Seen in 2 paper sets of the 2026 exam").

**Admin** (`/admin`)

- **Research centre** (`/admin/research`): the review workload (ready for review, formula/symbol-loss notes, figures, low confidence, no official answer, partly missing answers, suggested chapters), the import and review queue per source document, and the registry of official sources found, imported and blocked.
- Dashboard with live counts:
  - provenance distribution and questions by board, class, subject and year;
  - pending, rejected and duplicate groups;
  - figure and OCR issues and suggested mappings.
- **Review queue**: per source, with evidence, bulk verify / verify and publish / reject. Verifying requires confirming the document was checked, and the provenance rule is re-applied to every question.
- **Sources**: full source metadata (authority, session, paper code, set, series, language, answer source, pages and more).
- **Import**: read a PDF's text layer (pdf.js) or run OCR on scans and images (Tesseract.js), in the editor's browser. Only the text is sent to the server. The importer segments questions, detects numbers, sections, marks, pages and options, classifies the type, scores confidence, flags likely duplicates, and suggests a chapter.
- **Duplicates**: merge or split canonical groups.
- **AI**: optional chapter suggestions and AI practice drafts.
- Question editor: an AI-written question can't be turned into a PYQ, and a missing answer key stays missing.

---

## Architecture

- **Next.js 16 + React 19 + TypeScript + Tailwind v4**, deployed to **Cloudflare Workers** with OpenNext. The compressed Worker is about 1.8 MB, well under the free plan's 3 MB limit.
- **Cloudflare D1** (SQLite) via Drizzle. Migrations are in `drizzle/migrations`:
  - `0001` adds the provenance and ingestion columns;
  - `0002` corrects the demo bank's provenance and adds the ICSE/CBSE Classes 6–12 taxonomy.
- **Browser-only libraries** (pdf-lib, fontkit, pdf.js, Tesseract.js) are loaded on demand from jsDelivr at pinned versions, so they never enter the Worker bundle (`src/lib/browser-libs.ts`).
- **AI** is behind a provider interface (`src/lib/ai/`): Cloudflare Workers AI through the `AI` binding (free daily allowance, no API key), or no AI at all. Everything except the two AI tools works without it. In local development remote bindings are off; set `EXAMREADY_REMOTE_AI=1` after `npx wrangler login` to try AI locally.
- **Motion** is CSS-first (`globals.css`) with two small client components:
  - `AcademicField` (homepage hero): study objects (atom, DNA, circuit, molecule, globe, book, graph, compass…) are pushed or pulled by the cursor with faint field lines, drift toward the centre card while the search box is focused, and on touch screens respond to taps and drift gently with scrolling. The loop only runs while something moves and the hero is visible.
  - `MotionRoot`: one set of delegated listeners for scroll reveal, tilt cards, magnetic buttons and press feedback (`data-fx="pulse"` electric ring, `data-fx="ripple"` ink ripple).
  - Reusable classes: `.fx-spring`, `.fx-lift`, `.fx-sweep`, `.fx-buzz`, `.pick` (selectable chips), `.glyph` (per-subject motion: circuit pulse for physics, orbiting electron for chemistry, DNA twist for biology, compass arc for mathematics, scroll for history, turning globe for geography), `.numeral-roll`, `.pdf-build`.
  - `prefers-reduced-motion` shows a static final state everywhere.
- **Cloudflare free plan (10 ms CPU per request)**: long lists are paginated (review queue 15, PYQ lists 10–12), list cards show a one-line citation instead of the full provenance panel, and coverage, the sitemap and the class pages use a handful of grouped queries instead of per-subject loops.

```
src/app/(site)/        public pages: home, practice, pyq hubs, pyqs explorer, search, coverage, questions, sources, paper, results, SEO routes
src/app/test/[id]/     focused exam page
src/app/admin/         admin panel, review queue, research centre, sources, import, duplicates, AI, server actions
src/lib/engine/        pure logic: generator, coverage, grading, ingestion parser, search intent (unit tested)
src/lib/data/          D1 queries: questions, papers, attempts, trends, coverage, research, admin
src/lib/provenance.ts  the provenance rules and labels
src/lib/ai/            AI provider abstraction + validated tasks
src/data/sources/      official source packs (real questions, pending review)
src/data/source-registry.json  official sources found, imported and blocked
src/data/demo/         AI-written demo practice bank
src/data/taxonomy.json boards, classes, subjects; chapters where the syllabus is known precisely
scripts/               DB setup, demo seed, source-pack importer (idempotent) and validator
```

### Provenance categories

| Category | Meaning |
| --- | --- |
| `VERIFIED_PYQ` | From a board-exam paper. Shown as **Verified PYQ** only after editor review and when linked to a paper with a year. Otherwise shown as "PYQ · pending review". |
| `OFFICIAL_SAMPLE` | Official specimen or sample material. |
| `USER_CONTRIBUTED` | Community contribution. |
| `AI_SUPPLEMENTARY` | Written by AI. Never a PYQ, never in PYQ counts. |
| `PENDING_REVIEW` | Origin not established yet. |

Each category has its own colour, border style and icon.

The rules are enforced in `src/lib/provenance.ts` and covered by tests:

- demo and AI questions can never become PYQs;
- removing a source link or year un-verifies a question automatically;
- frequency counts only verified appearances, by distinct exam year.

---

## Environment

| Name | Where | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | secret | Admin password (8+ characters) |
| `SESSION_SECRET` | secret | Signs the admin cookie (32+ characters) |
| `SITE_URL` | `wrangler.jsonc` vars | Public URL (canonical links, sitemap) |
| `NEXT_PUBLIC_SITE_URL` | build variable | Same URL, for pages rendered at build time |
| `SHOW_DEMO_DATA` | `wrangler.jsonc` vars | `"false"` hides the demo bank |
| `AI` | `wrangler.jsonc` binding | Workers AI (optional) |

Locally, secrets live in `.dev.vars` (git-ignored). Never commit it.

---

## Deploying the Phase 2 update

Nothing here touches production until you run it.

1. **Migrate the database.** This reclassifies the demo bank as AI practice, removes its fictional papers, and adds the new taxonomy. Existing papers and attempts are kept.
   ```bash
   npm run db:migrate:remote
   ```
2. **Load the official source packs.** Questions arrive as pending review. The step is idempotent and never overwrites review decisions, verified questions or existing duplicate links; re-running it after new packs are added only inserts what's new (Phase 3 adds 32 packs and the new syllabus chapters, and needs no migration).
   ```bash
   npm run db:sources:remote
   ```
3. **Deploy.** Push to GitHub if the repository is connected to Cloudflare, or run:
   ```bash
   $env:NEXT_PUBLIC_SITE_URL="https://examready.nishitcreates-business.workers.dev"; npm run deploy   # PowerShell
   ```
4. **Review.** Sign in at `/admin/review` and verify the CBSE questions against the official PDFs.

Workers AI needs no setup: the `AI` binding is in `wrangler.jsonc`, and it uses Cloudflare's free daily allowance. If the allowance runs out, AI tools report "unavailable" and nothing else is affected.

If a local OpenNext build fails with `EPERM` on `.next` or `.open-next`, stop any running `npm run dev` first; the dev server holds files in those folders.

---

## Limitations (honest status)

- **No question is verified yet.** 1,688 official questions (640 from board papers, 1,048 from samples and specimens) are loaded and waiting for editor review. Until that happens, PYQ hubs and PYQ-only papers correctly show "not available yet".
- **ICSE/ISC have no PYQs.** CISCE publishes specimen papers online but not past board papers (they are sold in print), so ICSE/ISC content is official specimen material, not previous-year questions. Past papers can be added through the importer from files you have the right to use.
- **Coverage is uneven.** CBSE Class 10 Science has five board papers across 2023–2026; most other subjects have one or two years. Classes 6–9 and 11 have no official papers (there is no board exam). CBSE Mathematics Basic, English, Hindi, languages, Computer Applications and Informatics Practices, ICSE specimens before 2026 and ICSE Class 9 specimens are not processed yet.
- **Scanned papers were skipped.** Several CBSE sets have no text layer (for example 2024 X Science 31/1–31/3, 2026 X Social Science 32/1–32/3 and every 2025 XII Mathematics set). They need OCR and careful checking through `/admin/import`.
- **Some official answers are missing.** The 2026 XII Physics marking scheme is image-only (no answers extracted); drawn structures, diagrams and some equations in other schemes are missing and flagged.
- **Notation losses are flagged, not hidden.** Maths and physics text layers often drop symbols (√, ∫, Greek letters, fraction bars). Rebuilt notation is marked MEDIUM, lost notation LOW, and every such question lists the issue for the editor.
- Figures, maps and diagrams aren't reproduced; affected questions are flagged and link to the source page.
- Chapter mappings are suggestions until an editor confirms them. Six questions have no fitting syllabus chapter and are held back.
- Student accounts aren't built yet; attempt history is per device.

## Security

- The admin area uses a password plus an HMAC-signed, HTTP-only, `SameSite=Strict` cookie, and every admin page and server action checks it.
- All input is validated with Zod on the server.
- Uploaded files are read only in the editor's browser, after magic-byte, extension and size checks (25 MB). The server receives text only, so no uploaded file is stored or executed.
- There's no server-side URL fetching, so there's no SSRF surface.
- The answer key never reaches the browser during a test.
- There are no secrets in the code or the repository.
