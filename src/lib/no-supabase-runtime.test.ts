import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("src/lib/supabase/ is gone", () => {
  assert.equal(existsSync(resolve(root, "src/lib/supabase")), false);
});

test("no @supabase/* dependency remains in package.json", () => {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.deepEqual(
    Object.keys(all).filter((name) => name.startsWith("@supabase/")),
    [],
  );
});

test("no runtime source file imports Supabase", () => {
  // git grep over tracked files under src/, excluding tests and the migration
  // scripts/docs that legitimately name Supabase as the archive source.
  let hits = "";
  try {
    hits = execFileSync(
      "git",
      ["grep", "-l", "-E", "@supabase/|@/lib/supabase/|supabase\\.(auth|from|storage)", "--", "src/**/*.ts", "src/**/*.tsx"],
      { cwd: root, encoding: "utf8" },
    );
  } catch {
    // git grep exits 1 when there are no matches — that is the success case.
    hits = "";
  }
  const offenders = hits
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.includes(".test."));
  assert.deepEqual(offenders, [], `Supabase still imported by: ${offenders.join(", ")}`);
});
