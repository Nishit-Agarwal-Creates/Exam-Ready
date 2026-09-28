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
- loads the AI-written demo practice bank and the official CBSE source packs.

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

| Content | Category | Status |
| --- | --- | --- |
| CBSE Class 10 Science 2026, Q.P. 31/2/1 and 31/2/2 (official papers + official marking scheme answers) | PYQ | **Pending review**, 90 questions |
| CBSE Class 10 Science 2025, Q.P. 31/1/1 (official paper, no marking scheme published) | PYQ | **Pending review**, 45 questions, no answer keys |
| ICSE Classes 8–10 practice bank (428 questions written by AI for demonstration) | AI practice (demo) | Labelled "DEMO DATA", never a PYQ |

The official questions were extracted verbatim from the PDFs CBSE publishes at cbse.gov.in. The source packs are in `src/data/sources/*.json`, and the format is documented in `src/data/sources/FORMAT.md`.

Each pack records:

- the source URL and the file inside the archive,
- the year, Q.P. code, set and series,
- the page number of every question,
- the marks and where they came from,
- figures that couldn't be reproduced,
- extraction confidence and notes,
- official marking-scheme answers, where they exist.

Chapter mappings are marked *suggested*.

**Until an editor verifies them in `/admin/review`, these questions are not used in PYQ papers, not shown publicly and not counted in any statistic.** Verifying is quick: open a source, keep the official PDF open beside it (page numbers are shown), select the questions, confirm, and choose "Verify and publish". 32 questions that appear in both 2026 sets are linked as duplicates, so they count once.

Maths papers were not imported, because their PDF text layers drop symbols (√, θ, fractions). They need OCR or manual transcription through the importer.

---

## Features

**Student side**

- **PYQ explorer** (`/pyqs`): board → class → subject → year → paper → questions, with filters for year, chapter, marks, type, source and repeated questions. Each question has a provenance panel with board, year, paper, question number, page and status.
- **Paper builder** (`/practice`):
  - eight modes: PYQ only, Recent PYQs, Most repeated PYQs, PYQ priority, Exam simulation, PYQ + official sample, Practice mix, AI practice;
  - full-syllabus or chapter-wise scope;
  - live year-by-year coverage before you build.

  Non-PYQ questions only fill gaps if the student ticks "allow". The generation dialog replays the steps the engine actually ran.
- **Online test**: timer, palette, mark for review, autosave and resume, submit confirmation, auto-submit, and figure notices linking to the source page.
- **Results**:
  - score, accuracy, attempted, unanswered, marked for review and time used;
  - breakdowns by chapter, type, section and source;
  - a revision list.

  Questions without an official key are self-marked, and no answer is invented. There is no rank or percentile.
- **PDF**: DejaVu Unicode fonts embedded, so subscripts, arrows, √ and π print correctly. Each verified PYQ carries a citation, figure notes point to the source page, and the answer key labels each answer as official scheme, editor or AI.
- **Sources** (`/sources`): a public record for every document, showing what's extracted, what's verified and where it came from.
- **Search** (`/search`): across published questions by text, board, class, subject, chapter, year and source.
- **Coverage and trends** on every subject page, computed from verified data only. "Repeated" means the same question appeared in two or more *exam years*.

**Admin** (`/admin`)

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
- **Motion** is CSS-first (`globals.css`): converging hero objects, scroll reveal, pointer parallax and spotlight, tilt cards, magnetic buttons, and the generation and results animations. A single small client component drives it with delegated listeners. `prefers-reduced-motion` shows a static final state.

```
src/app/(site)/        public pages: home, practice, pyqs, search, sources, paper, results, SEO routes
src/app/test/[id]/     focused exam page
src/app/admin/         admin panel, review queue, sources, import, duplicates, AI, server actions
src/lib/engine/        pure logic: generator, coverage, grading, ingestion parser (unit tested)
src/lib/data/          D1 queries: questions, papers, attempts, trends, admin
src/lib/provenance.ts  the provenance rules and labels
src/lib/ai/            AI provider abstraction + validated tasks
src/data/sources/      official source packs (real questions, pending review)
src/data/demo/         AI-written demo practice bank
src/data/taxonomy.json boards, classes, subjects; chapters where the syllabus is known precisely
scripts/               DB setup, demo seed, source-pack importer (idempotent)
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
2. **Load the official source packs.** Questions arrive as pending review. The step is idempotent and never overwrites review decisions.
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

- **No verified PYQs are published yet.** 135 official CBSE questions are extracted and waiting for editor review. ICSE papers aren't imported: CISCE's website refused automated access during this work, so ICSE papers have to be added through the importer from files you have the right to use.
- **Years covered: CBSE Class 10 Science 2025 and 2026 only.** Other subjects and classes show "not yet available", and "Most repeated" needs two or more verified exam years.
- Questions that depend on a figure are flagged and link to the source page. Figures aren't reproduced.
- Chemistry subscripts in the extracted text are flattened (for example H2SO4). This is flagged per question.
- Student accounts aren't built yet; attempt history is per device.

## Security

- The admin area uses a password plus an HMAC-signed, HTTP-only, `SameSite=Strict` cookie, and every admin page and server action checks it.
- All input is validated with Zod on the server.
- Uploaded files are read only in the editor's browser, after magic-byte, extension and size checks (25 MB). The server receives text only, so no uploaded file is stored or executed.
- There's no server-side URL fetching, so there's no SSRF surface.
- The answer key never reaches the browser during a test.
- There are no secrets in the code or the repository.
