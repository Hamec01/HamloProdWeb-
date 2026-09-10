import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  "src/lib/auth/response.ts",
  "src/lib/auth/admin-roles.ts",
  "src/lib/auth/admin-auth-service.ts",
  "src/lib/auth/admin-ports.ts",
  "src/app/api/admin/auth/login/route.ts",
  "src/app/api/admin/auth/logout/route.ts",
  "src/app/api/admin/auth/refresh/route.ts",
  "src/app/api/admin/auth/me/route.ts",
];

const PUBLIC_AUTH_PATH = [
  "src/lib/auth/public-session.ts",
  "src/lib/auth/public-session-store.ts",
  "src/lib/auth/public-cookies.ts",
  "src/lib/auth/public-auth-service.ts",
  "src/lib/auth/public-ports.ts",
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/signup/route.ts",
  "src/app/api/auth/logout/route.ts",
  "src/app/api/auth/me/route.ts",
];

const STORAGE_ROUTES = [
  "src/app/api/admin/storage/upload-url/route.ts",
  "src/app/api/admin/storage/finalize/route.ts",
];

const SUPABASE = /@supabase\/|@\/lib\/supabase\/|supabase\.auth/;

test("no file in the admin auth path imports Supabase", () => {
  for (const file of ADMIN_AUTH_PATH) {
    assert.doesNotMatch(read(file), SUPABASE, `${file} imports Supabase`);
  }
});

test("no file in the buyer (public) auth path imports Supabase", () => {
  for (const file of PUBLIC_AUTH_PATH) {
    assert.doesNotMatch(read(file), SUPABASE, `${file} imports Supabase`);
  }
});

test("storage routes no longer reference Supabase env / client", () => {
  for (const file of STORAGE_ROUTES) {
    assert.doesNotMatch(read(file), /hasSupabaseEnv|@\/lib\/supabase\/|@supabase\//, `${file} still references Supabase`);
  }
});

test("proxy / middleware does not touch Supabase (file removed in M6.1a)", () => {
  for (const candidate of ["src/proxy.ts", "src/middleware.ts", "middleware.ts"]) {
    const abs = resolve(root, candidate);
    if (existsSync(abs)) {
      assert.doesNotMatch(readFileSync(abs, "utf8"), SUPABASE, `${candidate} still references Supabase`);
    }
  }
  assert.equal(existsSync(resolve(root, "src/proxy.ts")), false, "src/proxy.ts should be removed");
});

test("the raw session token is never console-logged in the auth path", () => {
  for (const file of [
    "src/lib/auth/session.ts",
    "src/app/api/admin/auth/login/route.ts",
    "src/app/api/admin/auth/logout/route.ts",
    "src/app/api/admin/auth/refresh/route.ts",
  ]) {
    assert.doesNotMatch(read(file), /console\.(log|info|warn|error)\([^)]*\btoken\b/i, `${file} logs a token`);
  }
});

test("auth endpoints set Cache-Control: no-store", () => {
  assert.match(read("src/lib/auth/response.ts"), /no-store/);
  for (const file of [
    "src/app/api/admin/auth/login/route.ts",
    "src/app/api/admin/auth/logout/route.ts",
    "src/app/api/admin/auth/refresh/route.ts",
    "src/app/api/admin/auth/me/route.ts",
  ]) {
    assert.match(read(file), /jsonNoStore/, `${file} should use jsonNoStore`);
  }
});
