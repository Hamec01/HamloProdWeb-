import test from "node:test";
import assert from "node:assert/strict";
import type { Beat as PrismaBeat } from "@prisma/client";
import { formatDuration, toAdminBeat, toBeatRecord, toPublicBeat } from "./beat-mappers";
import type { BeatRecord } from "@/types/beat";

const row: PrismaBeat = {
  id: "b1",
  slug: "night-drive",
  caseNumber: "CASE-007",
  title: "Night Drive",
  status: "available",
  genre: "trap",
  substyle: "Dark",
  mood: "Moody",
  bpm: 140,
  description: "desc",
  durationSeconds: 152,
  coverPalette: "from-a via-b to-c",
  priceUsd: 120,
  priceRub: 9000,
  featured: true,
  availableForDownload: false,
  coverKey: "beats/b1/cover/c.png",
  previewKey: "beats/b1/preview/p.mp3",
  masterKey: "beats/b1/master/m.wav",
  archiveKey: "beats/b1/archive/a.zip",
  previewFileName: "p.mp3",
  previewMimeType: "audio/mpeg",
  previewSizeBytes: 1234,
  publishedAt: new Date("2026-09-01T00:00:00.000Z"),
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-02T00:00:00.000Z"),
};

const resolve = (key: string | null) => (key ? `https://cdn.test/${key}` : null);

test("formatDuration", () => {
  assert.equal(formatDuration(152), "02:32");
  assert.equal(formatDuration(0), "00:00");
  assert.equal(formatDuration(3661), "61:01");
  assert.equal(formatDuration(null), null);
  assert.equal(formatDuration(-5), null);
});

test("toBeatRecord converts dates and keeps every key", () => {
  const record = toBeatRecord(row);
  assert.equal(record.createdAt, "2026-08-01T00:00:00.000Z");
  assert.equal(record.publishedAt, "2026-09-01T00:00:00.000Z");
  assert.equal(record.masterKey, "beats/b1/master/m.wav");
});

test("PUBLIC DTO never carries private keys / paths / upload state", () => {
  const record = toBeatRecord(row);
  const pub = toPublicBeat(record, resolve);

  const serialized = JSON.stringify(pub);
  for (const forbidden of ["masterKey", "archiveKey", "coverKey", "previewKey", "master/m.wav", "archive/a.zip", "previewStoragePath", "wavFilePath", "uploadIntent", "publishedAt"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden), `public DTO leaked ${forbidden}`);
  }

  assert.equal(pub.coverImageUrl, "https://cdn.test/beats/b1/cover/c.png");
  assert.equal(pub.previewUrl, "https://cdn.test/beats/b1/preview/p.mp3");
  assert.equal(pub.duration, "02:32");
});

test("PUBLIC DTO returns null URLs when there is no key", () => {
  const record: BeatRecord = { ...toBeatRecord(row), coverKey: null, previewKey: null };
  const pub = toPublicBeat(record, resolve);
  assert.equal(pub.coverImageUrl, null);
  assert.equal(pub.previewUrl, null);
});

test("ADMIN DTO exposes storage references + presence flags", () => {
  const admin = toAdminBeat(toBeatRecord(row), resolve);
  assert.equal(admin.masterKey, "beats/b1/master/m.wav");
  assert.equal(admin.hasMaster, true);
  assert.equal(admin.hasArchive, true);
  assert.equal(admin.durationSeconds, 152);
  assert.equal(admin.publishedAt, "2026-09-01T00:00:00.000Z");
  // still no raw upload intent
  assert.doesNotMatch(JSON.stringify(admin), /uploadIntent/i);
});
