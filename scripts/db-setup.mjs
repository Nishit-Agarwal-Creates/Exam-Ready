// Prepares the local development database (Cloudflare D1 emulated by Wrangler in .wrangler/state):
//   1. creates .dev.vars with a random admin password if it does not exist
//   2. applies migrations from drizzle/migrations
//   3. seeds the demo question bank when the database is empty. With --reset it clears every
//      table and reloads the demo data (works while `next dev` is running).
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reset = process.argv.includes("--reset");
const wranglerBin = join(root, "node_modules", "wrangler", "bin", "wrangler.js");

function wrangler(args, opts = {}) {
  return execFileSync(process.execPath, [wranglerBin, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
    stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
}

const devVars = join(root, ".dev.vars");
if (!existsSync(devVars)) {
  const password = randomBytes(9).toString("base64url");
  writeFileSync(
    devVars,
    `# Local development secrets (git-ignored). Delete this file to regenerate.\nADMIN_PASSWORD=${password}\nSESSION_SECRET=${randomBytes(32).toString("hex")}\n`,
  );
  console.log(`\n[examready] Created .dev.vars. Local admin password: ${password}\n`);
} else {
  const match = readFileSync(devVars, "utf8").match(/^ADMIN_PASSWORD=(.*)$/m);
  if (match) console.log(`[examready] Local admin password (from .dev.vars): ${match[1]}`);
}

wrangler(["d1", "migrations", "apply", "DB", "--local"]);

let seeded = false;
try {
  const res = wrangler(["d1", "execute", "DB", "--local", "--json", "--command", "SELECT COUNT(*) AS n FROM questions WHERE is_demo = 1"], { capture: true });
  seeded = JSON.parse(res)[0].results[0].n > 0;
} catch {
  seeded = false;
}

if (!seeded || reset) {
  execFileSync(process.execPath, [join(root, "scripts", "build-seed.mjs")], { cwd: root, stdio: "inherit" });
  wrangler(["d1", "execute", "DB", "--local", "--file", join("drizzle", "seed", "seed.sql")], { capture: true });
  console.log("[examready] AI practice bank loaded. Every one of these questions is stamped AI practice in the app.");
} else {
  console.log("[examready] Local database already seeded. Run `npm run db:reset` to reload demo data.");
}

// With --reset, imported source-pack questions (and papers/attempts built from them) are cleared too,
// so every official question returns to "pending review". Local database only.
if (reset) {
  const packQuestions = "SELECT id FROM questions WHERE is_demo = 0 AND external_key LIKE '%#%'";
  wrangler(
    [
      "d1",
      "execute",
      "DB",
      "--local",
      "--command",
      `DELETE FROM generated_papers WHERE id IN (SELECT generated_paper_id FROM paper_questions WHERE question_id IN (${packQuestions})); DELETE FROM question_sources WHERE question_id IN (${packQuestions}); UPDATE questions SET canonical_question_id = NULL WHERE canonical_question_id IN (${packQuestions}); DELETE FROM questions WHERE id IN (${packQuestions}); UPDATE papers SET status = 'PENDING_REVIEW' WHERE source_key IS NOT NULL;`,
    ],
    { capture: true },
  );
}

// Official source packs (real questions, pending review). Idempotent: never overwrites review decisions.
execFileSync(process.execPath, [join(root, "scripts", "build-sources.mjs")], { cwd: root, stdio: "inherit" });
wrangler(["d1", "execute", "DB", "--local", "--file", join("drizzle", "seed", "sources.sql")], { capture: true });
console.log("[examready] Official source packs loaded (questions stay unverified until reviewed in /admin/review).");
