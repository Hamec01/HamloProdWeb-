import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const SUPABASE = /@supabase\/|@\/lib\/supabase\/|supabase\.(auth|from|storage)/;

const BEAT_PATH = [
  "src/lib/beats/service.ts",
  "src/lib/beats/to-player-track.ts",
  "src/lib/data/beat-mappers.ts",
  "src/lib/data/postgres/beat.postgres.ts",
  "src/lib/data/repositories/beat.repository.ts",
  "src/lib/storage/public-url.ts",
  "src/lib/validations/beat.ts",
  "src/app/api/admin/beats/route.ts",
  "src/app/api/admin/beats/[id]/route.ts",
];

test("the beat data/API path does not touch Supabase", () => {
  for (const file of BEAT_PATH) {
    assert.doesNotMatch(read(file), SUPABASE, `${file} references Supabase`);
  }
});

test("the Admin Beat UI does not import a Supabase browser/storage client", () => {
  const ui = read("src/components/admin/admin-beat-crud-manager.tsx");
  assert.doesNotMatch(ui, /@\/lib\/supabase\/|@supabase\/|createSupabaseBrowserClient|supabase\.storage/);
  assert.doesNotMatch(ui, /\bhasSupabase\b\s*[?:]/); // no hasSupabase gate
});

test("content.ts beat functions no longer use the Supabase mock fallback", () => {
  const content = read("src/services/content.ts");
  // getBeats / getFeaturedBeats / getBeatBySlug / getAdminBeats delegate to BeatService
  const beatSection = content.slice(content.indexOf("Beats: PostgreSQL only"));
  assert.match(content, /beatService = new BeatService\(\)/);
  assert.doesNotMatch(content, /mockBeats/);
  assert.match(beatSection, /beatService\.listPublic/);
});
