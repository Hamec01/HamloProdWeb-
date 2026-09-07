import test from "node:test";
import assert from "node:assert/strict";
import { beatCreateSchema, beatUpdateSchema } from "./beat";

const valid = {
  title: "Night Drive",
  slug: "night-drive",
  caseNumber: "CASE-7",
  genre: "trap" as const,
  priceUsd: 100,
  priceRub: 8000,
  featured: false,
  availableForDownload: false,
};

test("create: minimal valid payload; text fields default to null, status optional", () => {
  const parsed = beatCreateSchema.parse(valid);
  assert.equal(parsed.substyle, null);
  assert.equal(parsed.mood, null);
  assert.equal(parsed.bpm, null);
  assert.equal(parsed.description, null);
  assert.equal(parsed.durationSeconds, null);
  assert.equal(parsed.coverPalette, "from-stone-700 via-stone-900 to-zinc-950");
  assert.equal(parsed.status, undefined);
});

test("create: rejects an arbitrary object key (strict)", () => {
  assert.equal(beatCreateSchema.safeParse({ ...valid, coverKey: "beats/x/cover/y.png" }).success, false);
  assert.equal(beatCreateSchema.safeParse({ ...valid, masterKey: "beats/x/master/y.wav" }).success, false);
});

test("create: slug must be a clean lowercase slug", () => {
  assert.equal(beatCreateSchema.safeParse({ ...valid, slug: "Night Drive" }).success, false);
  assert.equal(beatCreateSchema.safeParse({ ...valid, slug: "night--drive" }).success, false);
  assert.equal(beatCreateSchema.safeParse({ ...valid, slug: "-night" }).success, false);
});

test("create: prices must be non-negative integers; bpm within range", () => {
  assert.equal(beatCreateSchema.safeParse({ ...valid, priceUsd: -1 }).success, false);
  assert.equal(beatCreateSchema.safeParse({ ...valid, priceRub: 12.5 }).success, false);
  assert.equal(beatCreateSchema.safeParse({ ...valid, bpm: 5 }).success, false);
  assert.equal(beatCreateSchema.safeParse({ ...valid, bpm: 400 }).success, false);
  assert.equal(beatCreateSchema.safeParse({ ...valid, bpm: 140 }).success, true);
});

test("update: absent key stays absent; explicit null is allowed for optional text", () => {
  const parsed = beatUpdateSchema.parse({ title: "New Title", mood: null });
  assert.deepEqual(Object.keys(parsed).sort(), ["mood", "title"]);
  assert.equal(parsed.mood, null);
  assert.equal("bpm" in parsed, false);
});

test("update: strict — no object keys", () => {
  assert.equal(beatUpdateSchema.safeParse({ previewKey: "beats/x/preview/y.mp3" }).success, false);
});
