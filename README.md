# ExamReady

**Practice what was actually asked.**

ExamReady builds custom exam papers from verified previous-year questions (PYQs), lets students take them as timed online tests or print them as PDFs, and shows where marks were lost. It starts with ICSE Classes 8, 9 and 10 (Mathematics, Physics, Chemistry, Biology), and the data model is built to add CBSE and other boards later.

The core rule: **a question is only ever presented as a previous-year question when it is linked to a stored board exam paper with a year.** Everything else is labelled for what it is: official sample, contributed, or AI-generated.

> **Demo data.** This repository ships with about 430 original demo questions so every feature can be tried. They were written for demonstration, are linked only to fictional papers with no year, and are shown everywhere with the label **DEMO DATA — NOT A VERIFIED PREVIOUS-YEAR QUESTION**. Delete them from the admin dashboard before launch.

---

## Quick start

Requirements: Node.js 20.9 or newer (tested on Node 24) and npm. You don't need a Cloudflare account for local development.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The first `npm run dev` does the following (via `scripts/db-setup.mjs`):

1. It creates `.dev.vars` with a random local admin password and session secret, and prints the password in the terminal.
2. It creates a local D1 (SQLite) database in `.wrangler/state` and applies the migrations.
3. It loads the demo question bank.

The admin area is at http://localhost:3000/admin. The password is in `.dev.vars`, and it's also printed each time `npm run dev` starts.

Production build:

```bash
npm run build
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Prepares the local DB if needed, then starts Next.js with local Cloudflare bindings |
| `npm run build` | Production Next.js build (typechecks too) |
| `npm test` | Unit tests for the paper engine, grading, import parser and provenance rules |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:reset` | Clears every table and reloads the demo data (works while `dev` is running) |
| `npm run db:generate` | Generates a new SQL migration after editing `src/db/schema.ts` |
| `npm run preview` | Builds the Cloudflare Worker and runs it locally in the Workers runtime |
| `npm run deploy` | Builds and deploys to Cloudflare Workers |

---

## What's in the MVP

| Area | Where |
| --- | --- |
| Homepage | `/` |
| Paper builder with a live estimate of what the paper will be made of | `/practice` |
| Paper view, model answers, print, PDF (with or without answer key) | `/paper/[id]` |
| Timed online test: palette, mark for review, autosave and resume, submit confirmation, auto-submit at zero | `/test/[id]` |
| Results: score, time, attempted/correct/incorrect, by chapter, type and source, revision list, self-marking of written answers | `/results/[id]` |
| Attempt history on this device | `/my-practice` |
| Question bank browser with filters | `/pyqs` |
| SEO pages | `/icse`, `/icse/class-9`, `/icse/class-9/chemistry`, `/…/chemistry/pyq`, `/…/chemistry/chapter-wise`, `/…/chemistry/[chapter]` |
| Admin: dashboard, questions (add/edit/delete, provenance, source links), source papers, import review, generated papers, demo-data removal | `/admin` |

Features that aren't built yet are labelled "coming later" in the UI (student accounts, CBSE). There are no buttons that don't work.

---

## Architecture

- **Next.js 16 (App Router) + React 19 + TypeScript.** Server components by default. Client components only where there is interaction (generator, exam, self-review, admin form).
- **Cloudflare Workers** via the [OpenNext adapter](https://opennext.js.org/cloudflare). The compressed Worker is about 1.9 MB, under the free plan's 3 MB limit.
- **Cloudflare D1 (SQLite) + Drizzle ORM.** The schema lives in `src/db/schema.ts`, and SQL migrations in `drizzle/migrations`. Locally, Wrangler emulates D1, so dev and production run the same SQL.
- **Tailwind CSS v4** with a small token-based design system in `src/app/globals.css`.
- **PDFs are generated in the browser** with `pdf-lib`, loaded only when a student clicks Download. This keeps it out of the initial bundle and off the Worker's CPU budget.
- **No paid AI API is needed.** Paper generation, grading, import parsing, duplicate detection and chapter suggestions are all deterministic code.

```
src/
  app/
    (site)/            public pages (homepage, practice, paper, results, SEO routes…)
    test/[id]/         focused exam page (no site chrome)
    admin/             sign-in, admin panel, server actions
    api/               estimate, papers, attempts, self-review
  components/          UI (provenance stamps, question block, exam runner, generator form…)
  db/                  Drizzle schema + D1 access
  lib/
    engine/            pure logic: generator, grading, import parser (unit tested)
    data/              database queries (taxonomy, questions, papers, attempts, admin)
    provenance.ts      the rules and labels for question sources
    pdf.ts             client-side PDF export
  data/demo/           demo question banks (JSON) → seeded by scripts/build-seed.mjs
drizzle/migrations/    SQL migrations
scripts/               local DB setup and seed builder
tests/                 node:test unit tests
```

### Data model

```
boards → classes → subjects → chapters → topics
questions ─┬─ question_sources ── papers        (each appearance of a question in a source paper)
           └─ paper_questions ── generated_papers ── attempts ── attempt_answers
import_batches → import_items                   (staged, reviewed by an editor before publishing)
users                                            (roles STUDENT/TEACHER/PARENT/ADMIN, plans FREE/PRO/INSTITUTE; for later)
```

Each question has `source_type` (`VERIFIED_PYQ`, `OFFICIAL_SAMPLE`, `USER_CONTRIBUTED`, `AI_SUPPLEMENTARY`), `verification_status` (`VERIFIED`, `UNVERIFIED`, `REJECTED`), `is_demo`, and a cached `frequency_count`. Year, paper name, question number and source URL live on the linked `papers` / `question_sources` rows rather than being copied onto the question, so a question that appeared in several papers keeps every appearance.

### Provenance rules (enforced in code)

All of these are in `src/lib/provenance.ts`, with tests in `tests/ingest.test.ts`.

- `VERIFIED_PYQ` + `VERIFIED` is refused unless the question links to a non-demo **board exam paper with a year**.
- If that link or paper is removed, or the paper loses its year, the question is automatically set back to unverified.
- Demo questions (`is_demo`) can never be shown as real PYQs, whatever their category.
- Frequency text ("asked in 3 stored papers") is only shown when it is backed by stored links.
- Unverified and rejected questions are never used in papers or shown publicly.
- The importer extracts numbers, sections and marks that are visibly present in the pasted text. It never assigns a year or source. An imported question only becomes verified when an editor ticks "I checked this against the source paper".

### Paper modes

The engine is in `src/lib/engine/generator.ts`.

- **PYQ only**: uses verified PYQs only. If they can't make the requested total, the paper is not padded. Instead the student sees the available marks and the largest paper that can be made, with one-click alternatives.
- **PYQ priority**: fills with verified PYQs first, then official samples, then reviewed contributed questions, then reviewed AI questions. It uses as little lower-priority material as possible, and hits the exact total with a subset-sum step.
- **Exam simulation**: Section A (questions of 1–2 marks) and Section B (3–5 marks), split roughly in half and rebalanced if the bank is short of one kind.

Every paper stores and shows its actual composition by marks.

### Grading

- MCQ, fill in the blank and numerical answers are marked on the server after submission. The answer key never reaches the browser during a test.
- Written answers are self-marked against the model answer.
- `src/lib/engine/grading.ts` returns a common result shape, so an AI or teacher evaluator can be added later without changing the results pages.

---

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | secret | Admin sign-in password (8+ characters) |
| `SESSION_SECRET` | secret | Signs the admin session cookie (32+ characters) |
| `SITE_URL` | `wrangler.jsonc` vars | Public URL, used for canonical links and the sitemap at runtime |
| `NEXT_PUBLIC_SITE_URL` | build environment | Same URL, used for pages pre-rendered at build time (homepage, robots.txt) |
| `SHOW_DEMO_DATA` | `wrangler.jsonc` vars | `"false"` hides demo questions from papers and public pages |

Locally, secrets live in `.dev.vars` (created automatically; see `.dev.vars.example`). **Never commit `.dev.vars` or `.env` files.** Both are git-ignored.

---

## Deploying to Cloudflare

Nothing is deployed until you run these steps.

1. Log in and create the database:
   ```bash
   npx wrangler login
   npx wrangler d1 create examready
   ```
   Copy the printed `database_id` into `wrangler.jsonc` (it replaces `00000000-…`).

2. Set the public URL in `wrangler.jsonc` → `vars.SITE_URL` (e.g. `https://examready.in`). Set `SHOW_DEMO_DATA` to `"false"` if you won't load demo data.

3. Create the tables in the remote database:
   ```bash
   npm run db:migrate:remote
   ```
   Optionally load the demo bank: `npm run db:seed:remote`. Everything in it is labelled demo.

4. Add the secrets:
   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put SESSION_SECRET   # e.g. output of: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. Build and deploy:
   ```bash
   NEXT_PUBLIC_SITE_URL=https://your-domain npm run deploy
   ```
   On Windows PowerShell: `$env:NEXT_PUBLIC_SITE_URL="https://your-domain"; npm run deploy`.

6. Optionally attach a custom domain in the Cloudflare dashboard (Workers → examready → Settings → Domains & Routes).

To deploy from GitHub instead, connect the repository in **Workers & Pages → Create → Import a repository**. Use `npx opennextjs-cloudflare build` as the build command and `npx opennextjs-cloudflare deploy` as the deploy command, and add `NEXT_PUBLIC_SITE_URL` as a build variable.

**Plan note:** the app deploys on the Workers free plan. Server-rendered pages can exceed the free plan's per-request CPU allowance under load, so the Workers Paid plan (about US$5 a month) is recommended for a public launch. D1's free tier is enough for a large question bank.

To test the production Worker locally before deploying, run `npm run preview`.

---

## Replacing demo data with real questions

1. Sign in at `/admin`.
2. Go to **Source papers** and add each real paper: board exam, specimen or sample, with its year and a link to the original where possible.
3. Add questions one at a time (**Questions → Add question**), or paste a paper's text into **Import**, then review each extracted item.
4. On the dashboard, **Remove demo data** deletes every demo question, the fictional demo papers, and any generated papers and attempts that used them.
5. Set `SHOW_DEMO_DATA` to `"false"`.

### Adding a board, class or subject

Boards, classes, subjects, chapters and topics are database rows, so nothing is hard-coded to ICSE. Insert the new rows with a migration or seed file and they appear across the navigation, generator, SEO pages and sitemap. For subject pages to show useful content, give each subject an `overview` and `study_tips`, and each chapter a `summary`.

---

## Security

- The admin area is protected by a password plus an HMAC-signed, HTTP-only, `SameSite=Strict` session cookie. Every admin page **and** every server action checks the session on its own, not just the layout.
- All input is validated with Zod on the server. Chapter, topic and paper ids are checked against the chosen subject.
- The answer key is never sent to the browser during a test.
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) are set in `next.config.ts`.
- There are no hard-coded secrets. Secrets come from Wrangler secrets or `.dev.vars`.

## Future expansion

The schema and code leave room for:

- more boards (CBSE, state boards, JEE/NEET foundation)
- student, teacher and parent accounts (`users.role`)
- plans (`users.plan`)
- AI or teacher evaluation (`attempt_answers.evaluation_method`)
- AI-assisted import classification (the review step is already in place)
- topic-level frequency analytics (`question_sources`)

None of these are switched on yet.
