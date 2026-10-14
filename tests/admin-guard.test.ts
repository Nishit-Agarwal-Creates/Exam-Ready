import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Admin permissions are enforced in code (requireAdmin), so these checks keep every entry point guarded.
const root = join(import.meta.dirname, "..");

test("every admin server action except login and logout checks the admin session first", () => {
  const src = readFileSync(join(root, "src/app/admin/actions.ts"), "utf8");
  const actions = [...src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)];
  assert.ok(actions.length >= 10);
  for (const [, name, body] of actions) {
    if (name === "loginAction" || name === "logoutAction") continue;
    assert.match(body, /await requireAdmin\(\)/, `${name} must call requireAdmin()`);
  }
});

test("the admin panel layout requires an admin session for every page under it", () => {
  const layout = readFileSync(join(root, "src/app/admin/(panel)/layout.tsx"), "utf8");
  assert.match(layout, /await requireAdmin\(\)/);
  // Every admin page lives under the guarded (panel) group, apart from the login page.
  const pages: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e === "page.tsx") pages.push(p.replace(/\\/g, "/"));
    }
  };
  walk(join(root, "src/app/admin"));
  const outside = pages.filter((p) => !p.includes("/(panel)/") && !p.includes("/login/"));
  assert.deepEqual(outside, []);
});
