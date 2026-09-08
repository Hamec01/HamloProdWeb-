import test from "node:test";
import assert from "node:assert/strict";
import { BeatService } from "./service";
import type {
  BeatCreateInput,
  BeatListQuery,
  BeatRepository,
  BeatUpdateInput,
} from "@/lib/data/repositories/beat.repository";
import type { BeatRecord } from "@/types/beat";

function makeRecord(over: Partial<BeatRecord> = {}): BeatRecord {
  return {
    id: over.id ?? "b1",
    slug: over.slug ?? "night-drive",
    caseNumber: over.caseNumber ?? "CASE-7",
    title: over.title ?? "Night Drive",
    status: over.status ?? "private",
    genre: over.genre ?? "trap",
    substyle: over.substyle ?? null,
    mood: over.mood ?? null,
    bpm: over.bpm ?? null,
    description: over.description ?? null,
    durationSeconds: over.durationSeconds ?? null,
    coverPalette: over.coverPalette ?? "from-a via-b to-c",
    priceUsd: over.priceUsd ?? 100,
    priceRub: over.priceRub ?? 8000,
    featured: over.featured ?? false,
    availableForDownload: over.availableForDownload ?? false,
    coverKey: over.coverKey ?? null,
    previewKey: over.previewKey ?? null,
    masterKey: over.masterKey ?? null,
    archiveKey: over.archiveKey ?? null,
    previewFileName: over.previewFileName ?? null,
    previewMimeType: over.previewMimeType ?? null,
    previewSizeBytes: over.previewSizeBytes ?? null,
    publishedAt: over.publishedAt ?? null,
    createdAt: over.createdAt ?? "2026-08-01T00:00:00.000Z",
    updatedAt: over.updatedAt ?? "2026-08-01T00:00:00.000Z",
  };
}

class FakeRepo implements BeatRepository {
  rows = new Map<string, BeatRecord>();
  lastListQuery: BeatListQuery | null = null;

  constructor(seed: BeatRecord[] = []) {
    for (const r of seed) this.rows.set(r.id, r);
  }

  async list(query: BeatListQuery) {
    this.lastListQuery = query;
    let items = [...this.rows.values()];
    if (query.status) items = items.filter((r) => r.status === query.status);
    if (query.statusIn) items = items.filter((r) => query.statusIn!.includes(r.status));
    if (typeof query.featured === "boolean") items = items.filter((r) => r.featured === query.featured);
    if (query.publishedOnly) items = items.filter((r) => r.publishedAt !== null);
    return { items: items.slice(query.offset, query.offset + query.limit), total: items.length };
  }
  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findBySlug(slug: string) {
    return [...this.rows.values()].find((r) => r.slug === slug) ?? null;
  }
  async findByCaseNumber(caseNumber: string) {
    return [...this.rows.values()].find((r) => r.caseNumber === caseNumber) ?? null;
  }
  async create(input: BeatCreateInput) {
    const rec = makeRecord({
      ...input,
      id: `b${this.rows.size + 1}`,
      publishedAt: input.publishedAt ? input.publishedAt.toISOString() : null,
    });
    this.rows.set(rec.id, rec);
    return rec;
  }
  async update(id: string, input: BeatUpdateInput) {
    const cur = this.rows.get(id);
    if (!cur) return null;
    const next = makeRecord({
      ...cur,
      ...input,
      publishedAt: input.publishedAt ? input.publishedAt.toISOString() : cur.publishedAt,
    });
    this.rows.set(id, next);
    return next;
  }
  async delete(id: string) {
    return this.rows.delete(id);
  }
}

// The unique-violation → 409 path needs a real Prisma `P2002` and is covered in
// beat.postgres.db.test.ts. Here we test everything else with an in-memory repo.

const ADMIN = "ADMIN" as const;

test("create: invalid payload → 422", async () => {
  const svc = new BeatService(new FakeRepo());
  const res = await svc.create({ title: "x" }, ADMIN);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 422);
});

test("create: non-admin role → 403", async () => {
  const svc = new BeatService(new FakeRepo());
  // @ts-expect-error deliberately bad role
  const res = await svc.create({ title: "Night Drive", slug: "night-drive", caseNumber: "C-7", genre: "trap", priceUsd: 1, priceRub: 1, featured: false, availableForDownload: false }, "USER");
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 403);
});

test("create: default status is private and publishedAt stays null", async () => {
  const repo = new FakeRepo();
  const svc = new BeatService(repo);
  const res = await svc.create(
    { title: "Night Drive", slug: "night-drive", caseNumber: "CASE-7", genre: "trap", priceUsd: 100, priceRub: 8000, featured: false, availableForDownload: false },
    ADMIN,
  );
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.data.status, "private");
    assert.equal(res.data.publishedAt, null);
    // admin DTO, but never a bare uploadIntent
    assert.doesNotMatch(JSON.stringify(res.data), /uploadIntent/i);
  }
});

test("create: available without assets is rejected", async () => {
  const svc = new BeatService(new FakeRepo());
  const res = await svc.create(
    { title: "Live One", slug: "live-one", caseNumber: "CASE-8", genre: "trap", priceUsd: 100, priceRub: 8000, featured: false, availableForDownload: false, status: "available" },
    ADMIN,
  );
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, "MISSING_REQUIRED_ASSETS");
});

test("update: missing beat → 404", async () => {
  const svc = new BeatService(new FakeRepo());
  const res = await svc.update("nope", { title: "New" }, ADMIN);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 404);
});

test("update: publishing sets publishedAt once, never clears it", async () => {
  const repo = new FakeRepo([makeRecord({ id: "b1", status: "private", publishedAt: null, coverKey: "cover", previewKey: "preview" })]);
  const svc = new BeatService(repo);

  const first = await svc.update("b1", { status: "available" }, ADMIN);
  assert.equal(first.ok, true);
  const publishedAt = first.ok ? first.data.publishedAt : null;
  assert.notEqual(publishedAt, null);

  const backToPrivate = await svc.update("b1", { status: "private" }, ADMIN);
  assert.equal(backToPrivate.ok, true);
  if (backToPrivate.ok) assert.equal(backToPrivate.data.publishedAt, publishedAt);
});

test("delete: available and private can be removed", async () => {
  const repo = new FakeRepo([makeRecord({ id: "a", status: "available" }), makeRecord({ id: "p", status: "private" })]);
  const svc = new BeatService(repo);
  assert.equal((await svc.delete("a", ADMIN)).ok, true);
  assert.equal((await svc.delete("p", ADMIN)).ok, true);
  assert.equal(repo.rows.size, 0);
});

test("delete: reserved and sold are blocked with 409", async () => {
  const repo = new FakeRepo([makeRecord({ id: "r", status: "reserved" }), makeRecord({ id: "s", status: "sold" })]);
  const svc = new BeatService(repo);

  for (const id of ["r", "s"]) {
    const res = await svc.delete(id, ADMIN);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 409);
      assert.equal(res.code, "STATUS_LOCKED");
    }
  }
  assert.equal(repo.rows.size, 2);
});

test("delete: missing beat → 404", async () => {
  const res = await new BeatService(new FakeRepo()).delete("nope", ADMIN);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 404);
});

test("listPublic: only published available/reserved; no private keys in the DTO", async () => {
  const repo = new FakeRepo([
    makeRecord({ id: "1", slug: "pub-avail", status: "available", publishedAt: "2026-09-01T00:00:00.000Z", masterKey: "beats/1/master/m.wav" }),
    makeRecord({ id: "2", slug: "pub-reserved", status: "reserved", publishedAt: "2026-09-01T00:00:00.000Z" }),
    makeRecord({ id: "3", slug: "priv", status: "private", publishedAt: null }),
    makeRecord({ id: "4", slug: "sold", status: "sold", publishedAt: "2026-09-01T00:00:00.000Z" }),
    makeRecord({ id: "5", slug: "avail-unpublished", status: "available", publishedAt: null }),
  ]);
  const svc = new BeatService(repo);
  const list = await svc.listPublic();

  assert.deepEqual(list.map((b) => b.slug).sort(), ["pub-avail", "pub-reserved"]);
  assert.doesNotMatch(JSON.stringify(list), /masterKey|archiveKey|coverKey|previewKey|master\/m\.wav/);
  assert.ok(repo.lastListQuery?.publishedOnly);
});

test("getPublicBySlug: null for private / sold / unpublished", async () => {
  const repo = new FakeRepo([
    makeRecord({ id: "p", slug: "priv", status: "private", publishedAt: null }),
    makeRecord({ id: "s", slug: "sold", status: "sold", publishedAt: "2026-09-01T00:00:00.000Z" }),
    makeRecord({ id: "u", slug: "unpub", status: "available", publishedAt: null }),
    makeRecord({ id: "ok", slug: "ok", status: "available", publishedAt: "2026-09-01T00:00:00.000Z" }),
  ]);
  const svc = new BeatService(repo);

  assert.equal(await svc.getPublicBySlug("priv"), null);
  assert.equal(await svc.getPublicBySlug("sold"), null);
  assert.equal(await svc.getPublicBySlug("unpub"), null);
  assert.equal((await svc.getPublicBySlug("ok"))?.slug, "ok");
});

test("listAdmin: clamps limit to 1..100 and offset to >= 0", async () => {
  const repo = new FakeRepo([makeRecord()]);
  const svc = new BeatService(repo);
  await svc.listAdmin({ limit: 5000, offset: -3 });
  assert.equal(repo.lastListQuery?.limit, 100);
  assert.equal(repo.lastListQuery?.offset, 0);
});


test("publishing requires both cover and preview; master is not a publication requirement", async () => {
  for (const assets of [{}, { coverKey: "cover" }, { previewKey: "preview" }]) {
    const svc = new BeatService(new FakeRepo([makeRecord({ id: "b1", ...assets })]));
    const result = await svc.update("b1", { status: "available" }, ADMIN);
    assert.equal(result.ok, false);
    if (!result.ok) { assert.equal(result.status, 409); assert.equal(result.code, "MISSING_REQUIRED_ASSETS"); }
  }
});
