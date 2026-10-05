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

Everything below comes from documents the boards publish themselves. **Every official question is imported as "pending review"**: it isn't shown to students, used in papers or counted as a PYQ until it has been checked against the linked PDF, by an editor in `/admin/review` or by the review pipeline described under [Architecture](#review-pipeline).

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
| ISC Class 12 | Physics, Chemistry, Biology, Mathematics | 2018–2020 papers; 2025 Mathematics | 2026 and 2027 specimens; CISCE competency question banks |
| CBSE Classes 6–10 | Mathematics, Science | none (Classes 6–9 have no board exam) | CBSE competency-based item banks (September 2021) |

In numbers (after the Phase 5.1 release, October 2026): 256 source documents (100 published by the boards, 156 school examination papers) and 9,848 extracted questions. **8,086 are verified**: 7,951 by the automated review plus independent audit, 135 by an editor. 757 of them show a figure, table, graph, map or passage cropped from the original page. 1,686 are held, each with a stated reason: 709 have a chapter that couldn't be confirmed (often a topic outside the official syllabus summary), 552 have text, notation or marks that couldn't be fully confirmed, 195 wait for or were disputed by the second reviewer, 140 have an official answer that looks wrong or is drawn rather than written, and 90 need a figure that isn't printed, is illegible or couldn't be cropped cleanly. 152 are still awaiting review. Questions with no fitting syllabus chapter are not loaded.

Verified questions per class (one per duplicate group, AI practice never counted):

| Board | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ICSE / ISC | 726 | 758 | 725 | 754 | 1,725 | 899 | 1,064 |
| CBSE | 76 | 47 | 47 | 128 | 665 | – | 373 |

ICSE/ISC Classes 6–12 all meet the 600-question goal. Phase 5.1 recovered held questions from their source pages: figures cropped from the page, marks recorded only as printed (1,259 verified items show a printed group total and 342 a "no mark printed" note instead of an invented mark), printed groups split into their items, chapters mapped only where the official summary covers them, and every change independently re-audited.

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

- **Research centre** (`/admin/research`): the review pipeline (verified by automated review, verified by an editor, held, awaiting review, rejected), held questions grouped by reason with the most common reasons and a link to each queue, what is still awaiting review, a per-document table (auto-verified, editor-verified, held, pending, issues), and the registry of official sources found, imported, link-only and blocked.
- **Questions list**: filter by review result; each row shows its review state and, on hover, the reason it was held.
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
  - `0002` corrects the demo bank's provenance and adds the ICSE/CBSE Classes 6–12 taxonomy;
  - `0003` adds `review_state`, `review_reason` and `reviewed_at` for the review pipeline (additive; existing editor decisions are marked `EDITOR_VERIFIED`);
  - `0004` adds `cache_entries`, a small table for cached site-wide aggregates (see below).
- **Browser-only libraries** (pdf-lib, fontkit, pdf.js, Tesseract.js) are loaded on demand from jsDelivr at pinned versions, so they never enter the Worker bundle (`src/lib/browser-libs.ts`).
- **AI** is behind a provider interface (`src/lib/ai/`): Cloudflare Workers AI through the `AI` binding (free daily allowance, no API key), or no AI at all. Everything except the two AI tools works without it. In local development remote bindings are off; set `EXAMREADY_REMOTE_AI=1` after `npx wrangler login` to try AI locally.
- **Motion** is CSS-first (`globals.css`) with two small client components:
  - `AcademicField` (homepage hero): study objects (atom, DNA, circuit, molecule, globe, book, graph, compass…) are pushed or pulled by the cursor with faint field lines, drift toward the centre card while the search box is focused, and on touch screens respond to taps and drift gently with scrolling. The loop only runs while something moves and the hero is visible.
  - `MotionRoot`: one set of delegated listeners for scroll reveal, tilt cards, magnetic buttons and press feedback (`data-fx="pulse"` electric ring, `data-fx="ripple"` ink ripple).
  - Reusable classes: `.fx-spring`, `.fx-lift`, `.fx-sweep`, `.fx-buzz`, `.pick` (selectable chips), `.glyph` (per-subject motion: circuit pulse for physics, orbiting electron for chemistry, DNA twist for biology, compass arc for mathematics, scroll for history, turning globe for geography), `.numeral-roll`, `.pdf-build`.
  - `prefers-reduced-motion` shows a static final state everywhere.
- **D1 free plan (5 million rows read per day)**: site-wide aggregates (coverage, catalogue, sources, trends, per-subject stats) are cached in the Worker isolate and in `cache_entries` for 10 minutes (`src/lib/data/shared-cache.ts`), and every editor action clears the cache. A warm home page now reads about 45 rows instead of about 44,000; without the cache, crawler traffic exhausted the daily allowance and every page returned 500 until midnight UTC. The PYQ hubs cache the ordered list of matching question ids per filter combination the same way (a repeat view reads about 230–400 rows instead of about 3,000), and the "appeared in year X" filter is a single uncorrelated subquery (it used to read about 1.3 million rows per view). `sources.sql` and `review.sql` end by emptying `cache_entries`, so applying them never leaves stale counts.
- **Page cache (`worker.ts`)**: the Worker entry wraps OpenNext's handler and keeps anonymous full-page GETs of public pages in isolate memory for 60 seconds, so a burst of visitors or crawlers doesn't exhaust the CPU limit ("Worker exceeded resource limits", 1102). It never caches the admin (or anyone with the admin cookie), API routes, tests, results, papers, client-side navigation requests, non-200 responses, or a page whose render failed after streaming began. Admin actions clear it together with the shared cache.
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

### Review pipeline

Official questions are checked against their documents by a pipeline that never lets a single opinion publish anything:

1. **Review** (`src/data/reviews/<pack>.json`): a reviewer compares every question with the official PDF (verified by SHA-256) and its marking scheme and records, per question, text, number/page, marks, options, notation, figure, answer and chapter verdicts plus a decision. `npm run review:check` validates the files.
2. **Independent audit** (`src/data/reviews/audit-<pack>[--N].json`): a second reviewer re-checks every maths/science question that contains numbers or symbols, every rebuilt notation, corrected chapter or minor text difference, and a random sample of the rest, using `pdftotext -layout`, `-raw` and `-table` and pdfplumber. `npm run review:sample` picks the sample; `--missing` writes a follow-up sample for keys no audit covers yet.
3. **Deterministic checks**: `scripts/review/minus-scan.py` finds minus signs drawn as shapes (invisible to every text extractor) and holds affected questions; flattened powers ("10-3", "cm2") and official answers that contain an extractor's reconstruction are held; `src/data/reviews/holds.json` lists questions whose official document itself looks wrong, for an editor.
4. **Rights**: `src/data/reviews/rights.json` records whether each board's material may be reproduced. Boards marked `PERMITTED` or `OWNER_AUTHORISED` publish; the rest wait as `HOLD_RIGHTS`. ICSE/ISC is `OWNER_AUTHORISED`: the site owner chose (September 2026) to publish CISCE papers, specimens and item banks, and third-party-hosted school papers, with attribution to the original document and a link to where it was obtained, while written permission from CISCE is sought. If CISCE or a source owner objects, set it back to `PERMISSION_REQUIRED` (or hold the source) and re-run consolidation.
5. **Consolidation** (`npm run review:consolidate`) turns the evidence into `drizzle/seed/review.sql` and `src/data/reviews/summary.json`. A question is `AUTO_VERIFIED` only when every check passes; otherwise it gets exactly one hold state with its reasons. A disputed audit key is held; a pack whose audit disputes more than 20 % of its sample is held entirely. The SQL only touches questions that are still `UNVERIFIED`, so editor decisions are never overwritten, and it is safe to re-run.

| Review state | Meaning |
| --- | --- |
| `AUTO_VERIFIED` | Passed the review, the audit and every deterministic check; published and labelled "Checked by ExamReady's automated review". |
| `EDITOR_VERIFIED` | Verified by an editor. |
| `PENDING_REVIEW` | Imported, not reviewed yet. |
| `HOLD_MISSING_FIGURE` / `HOLD_ANSWER` / `HOLD_MAPPING` / `HOLD_LOW_CONFIDENCE` / `HOLD_AUDIT` / `HOLD_MISSING_SOURCE` | Held, with the reason stored in `review_reason` and shown in the admin. |
| `HOLD_RIGHTS` | Passed every check, but the board's terms require permission before reproduction. |
| `REJECTED_DUPLICATE` / `REJECTED_INVALID` | Rejected. |

### Scanned school papers (ICSE Classes 6–9, ISC 11)

CISCE sets board examinations only in Classes 10 and 12, so the lower classes use real school examination papers listed on icseboard.org (originally icseonline.com; the school is usually not named). Most are scans, so the pipeline is:

1. **Download and fingerprint** the one listed file (SHA-256 recorded in the pack).
2. **OCR** with RapidOCR on pages rendered by pypdfium2, then a reviewer reads every page image and corrects the text by hand. Handwriting, ticks, watermarks and adverts are ignored; the paper's own spelling mistakes are kept.
3. **Marks are never rounded, inferred or split.** If a paper prints only a total for a group of items, the group is one question carrying that total; if no mark is printed, the question is held.
4. **Review and audit against the page images** (zoomed crops for every fraction, power, subscript and sign). A question is held when it depends on a figure, passage, map or underlining the stored text doesn't contain, when its items span several chapters, or when a builder's mark couldn't be confirmed.
5. **Chapters** come from the official CISCE syllabuses: the Upper Primary curriculum (2016) for Classes 6–8, the ICSE 2028 syllabus for Class 9 and the ISC 2028 syllabus for Class 11. A question with no fitting chapter is not loaded.

Questions from school papers are labelled as such and never counted as board-exam PYQs.

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

## Deploying an update

For the Phase 5.1 release (recovered figures and marks status), apply migration `0005_recovery.sql` **before** the new code is deployed, because the code reads the new columns:

```bash
npm run db:migrate:remote      # 0005: marks_status, marks_note, figure (additive)
```

Then push (Cloudflare builds the Worker, including `public/figures`), and load the data:

```bash
npm run db:sources:remote      # packs; corrections reach only questions nobody has verified
npx wrangler d1 execute DB --remote --file=drizzle/seed/review.sql
```

`review.sql` publishes what passed review and audit. For questions the automated review verified earlier, it also applies the recovery pipeline's re-audited corrections, and takes off the site (never deletes) any it withdrew after an independent re-audit. Editor decisions are never touched.

For the Phase 4 release, in this order (each step is idempotent and never overwrites editor decisions):

```bash
npm run db:migrate:remote      # 0003 review columns and 0004 cache table (both additive)
npm run db:sources:remote      # new source packs and syllabus chapters
npx wrangler d1 execute DB --remote --file=drizzle/seed/review.sql   # review results; only touches UNVERIFIED rows
```

Then push to GitHub (Cloudflare builds and deploys the Worker), or deploy manually as below.

### Deploying the Phase 2 update

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

- **ICSE/ISC questions are held for permission.** CISCE's legal disclaimer (cisce.org/legal-disclaimer) forbids reproducing its material on another website or in a database without prior written permission. The specimen questions are extracted and checked, but held as `HOLD_RIGHTS` and linked, not shown. Once permission is received, set `boards.icse.status` to `PERMITTED` in `src/data/reviews/rights.json`, record the evidence, run `npm run review:consolidate` and apply `review.sql`. CISCE's ICSE Class X item banks (cisce.org/icse-item-banks-2024) fall under the same terms and were not imported.
- **Automated verification has limits.** It compares text layers, not rendered pages: the audit also used pdfplumber for superscripts and drawn minus signs, but a question can still carry a flattened subscript in its answer (for example "a30" for a₃₀). Every automated decision is reversible in `/admin/questions?review=AUTO_VERIFIED`.
- **Item-bank chapters are mapped to the current NCERT books.** The CBSE item banks were written in 2021 for the older books; items whose topic isn't in the current book are left out or held as "chapter to confirm". CBSE Class 9 Mathematics has only Ganita Manjari Part I chapters because Part II wasn't published when checked.
- **CBSE Class 11 and ICSE Classes 6–8 and 11 have no official material** (no board publishes papers for them). CBSE's "Curriculum Aligned Competency Based Test Items" are marked All Rights Reserved and are linked only.
- **ICSE/ISC have no PYQs.** CISCE publishes specimen papers online but not past board papers (they are sold in print), so ICSE/ISC content is official specimen material, not previous-year questions. Past papers can be added through the importer from files you have the right to use.
- **Coverage is uneven.** CBSE Class 10 Science has five board papers across 2023–2026; most other subjects have one or two years. Classes 6–9 and 11 have no official papers (there is no board exam). CBSE Mathematics Basic, English, Hindi, languages, Computer Applications and Informatics Practices, ICSE specimens before 2026 and ICSE Class 9 specimens are not processed yet.
- **Scanned papers were skipped.** Several CBSE sets have no text layer (for example 2024 X Science 31/1–31/3, 2026 X Social Science 32/1–32/3 and every 2025 XII Mathematics set). They need OCR and careful checking through `/admin/import`.
- **Some official answers are missing.** The 2026 XII Physics marking scheme is image-only (no answers extracted); drawn structures, diagrams and some equations in other schemes are missing and flagged.
- **Notation losses are flagged, not hidden.** Maths and physics text layers often drop symbols (√, ∫, Greek letters, fraction bars). Rebuilt notation is marked MEDIUM, lost notation LOW, and every such question lists the issue for the editor.
- Figures, tables, graphs, maps and passages are shown as crops of the original page (`public/figures/<pack>/`, cropped offline by `scripts/recovery/page.py`; never redrawn). Where a figure isn't printed in the PDF, is illegible or can't be cropped cleanly, the question stays held. Blank outline maps that students draw on are shown only where the paper itself prints them.
- Marks are shown only where the paper prints them for that item (or prints a per-item rule). Items under a printed group total show the total and are left out of generated papers, as are items with no printed mark.
- Chapter mappings of questions still awaiting review are suggestions; reviewed questions have a confirmed or corrected chapter. Questions with no fitting syllabus chapter are held back.
- Student accounts aren't built yet; attempt history is per device.

## Security

- The admin area uses a password plus an HMAC-signed, HTTP-only, `SameSite=Strict` cookie, and every admin page and server action checks it.
- All input is validated with Zod on the server.
- Uploaded files are read only in the editor's browser, after magic-byte, extension and size checks (25 MB). The server receives text only, so no uploaded file is stored or executed.
- There's no server-side URL fetching, so there's no SSRF surface.
- The answer key never reaches the browser during a test.
- There are no secrets in the code or the repository.
