import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

const ADMIN_AUTH_PATH = [
  "src/lib/auth/session.ts",
  "src/lib/auth/password.ts",
  "src/lib/auth/cookies.ts",
  "src/lib/auth/config.ts",
  "src/lib/auth/origin.ts",
  "src/lib/auth/throttle.ts",
  "src/lib/auth/request.ts",
  "src/lib/auth/admin-roles.ts",
  "src/lib/auth/admin-auth-service.ts",
  "src/lib/auth/admin-ports.ts",
  "src/app/api/admin/auth/login/route.ts",
  "src/app/api/admin/auth/logout/route.ts",
  "src/app/api/admin/auth/refresh/route.ts",
  "src/app/api/admin/auth/me/route.ts",
];

const STORAGE_ROUTES = [
  "src/app/api/admin/storage/upload-url/route.ts",
  "src/app/api/admin/storage/finalize/route.ts",
];

test("no file in the admin auth path imports Supabase", () => {
  for (const file of ADMIN_AUTH_PATH) {
    const source = read(file);
    assert.doesNotMatch(source, /@supabase\/|@\/lib\/supabase\//, `${file} imports Supabase`);
  }
});

test("storage routes no longer reference Supabase env / client", () => {
  for (const file of STORAGE_ROUTES) {
    const source = read(file);
    assert.doesNotMatch(source, /hasSupabaseEnv|@\/lib\/supabase\/|@supabase\//, `${file} still references Supabase`);
  }
});

test("proxy.ts skips Supabase refresh for admin paths", () => {
  const source = read("src/proxy.ts");
  assert.match(source, /\/api\/admin/);
  assert.match(source, /\/admin/);
});

test("the raw session token is never console-logged in the auth path", () => {
  for (const file of ["src/lib/auth/session.ts", "src/app/api/admin/auth/login/route.ts", "src/app/api/admin/auth/refresh/route.ts"]) {
    const source = read(file);
    assert.doesNotMatch(source, /console\.(log|info|warn|error)\([^)]*\btoken\b/i, `${file} logs a token`);
  }
});
