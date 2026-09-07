/**
 * DB-backed tests for PrismaBeatRepository + BeatService 409 path.
 * Skipped without DATABASE_URL. Every created row is deleted in `t.after`.
 */

import test from "node:test";
import assert from "node:assert/strict";

const CONFIGURED = Boolean(process.env.DATABASE_URL);

test("PrismaBeatRepository", { skip: !CONFIGURED && "no DATABASE_URL" }, async (t) => {
  const { prisma } = await import("@/lib/db/client");
  const { PrismaBeatRepository, isUniqueViolation } = await import("./beat.postgres");
  const { BeatService } = await import("@/lib/beats/service");

  const repo = new PrismaBeatRepository();
  const tag = `m2test-${crypto.randomUUID().slice(0, 8)}`;
  const created: string[] = [];

  const baseInput = {
    caseNumber: `${tag}-C1`,
    title: "Test Beat",
    status: "private" as const,
    genre: "trap" as const,
    substyle: null,
    mood: null,
    bpm: null,
    description: null,
    durationSeconds: null,
    coverPalette: "from-a via-b to-c",
    priceUsd: 100,
    priceRub: 8000,
    featured: false,
    availableForDownload: false,
    publishedAt: null,
  };

  t.after(async () => {
    await prisma.beat.deleteMany({ where: { OR: [{ slug: { startsWith: tag } }, { caseNumber: { startsWith: tag } }] } });
  });

  await t.test("create / findById / findBySlug / findByCaseNumber", async () => {
    const rec = await repo.create({ ...baseInput, slug: `${tag}-a` });
    created.push(rec.id);
    assert.match(rec.id, /^[0-9a-f-]{36}$/);
    assert.equal(rec.status, "private");
    assert.equal((await repo.findById(rec.id))?.slug, `${tag}-a`);
    assert.equal((await repo.findBySlug(`${tag}-a`))?.id, rec.id);
    assert.equal((await repo.findByCaseNumber(`${tag}-C1`))?.id, rec.id);
    assert.equal(await repo.findById(crypto.randomUUID()), null);
  });

  await t.test("unique slug / caseNumber violation surfaces as P2002", async () => {
    await assert.rejects(
      repo.create({ ...baseInput, slug: `${tag}-a` }),
      (err: unknown) => isUniqueViolation(err)?.target === "slug",
    );
    await assert.rejects(
      repo.create({ ...baseInput, slug: `${tag}-b`, caseNumber: `${tag}-C1` }),
      (err: unknown) => isUniqueViolation(err)?.target === "caseNumber",
    );
  });

  await t.test("BeatService maps the duplicate to 409", async () => {
    const svc = new BeatService(repo);
    const res = await svc.create(
      { slug: `${tag}-a`, caseNumber: `${tag}-C9`, title: "Dup", genre: "trap", priceUsd: 1, priceRub: 1, featured: false, availableForDownload: false },
      "ADMIN",
    );
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 409);
      assert.equal(res.code, "DUPLICATE");
    }
  });

  await t.test("CHECK constraints reject bad values", async () => {
    await assert.rejects(repo.create({ ...baseInput, slug: `${tag}-neg`, priceUsd: -1 }), /price_usd|constraint|violates/i);
    await assert.rejects(repo.create({ ...baseInput, slug: `${tag}-bpm`, bpm: 5 }), /bpm|constraint|violates/i);
    await assert.rejects(repo.create({ ...baseInput, slug: `${tag}-blank`, title: "   " }), /title|constraint|violates/i);
  });

  await t.test("list: pagination + stable createdAt desc, id desc", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const rec = await repo.create({ ...baseInput, slug: `${tag}-p${i}`, caseNumber: `${tag}-P${i}` });
      ids.push(rec.id);
    }
    const page1 = await repo.list({ limit: 2, offset: 0, statusIn: ["private"] });
    const page2 = await repo.list({ limit: 2, offset: 2, statusIn: ["private"] });
    assert.equal(page1.items.length, 2);
    assert.equal(new Set([...page1.items, ...page2.items].map((b) => b.id)).size, 4);

    const all = await repo.list({ limit: 50, offset: 0, statusIn: ["private"] });
    const scoped = all.items.filter((b) => b.slug.startsWith(`${tag}-p`));
    for (let i = 1; i < scoped.length; i += 1) {
      const a = scoped[i - 1];
      const b = scoped[i];
      const cmp = b.createdAt < a.createdAt || (b.createdAt === a.createdAt && b.id < a.id);
      assert.ok(cmp, "rows are ordered by createdAt desc, id desc");
    }
  });

  await t.test("list clamps limit to 100", async () => {
    const page = await repo.list({ limit: 100000, offset: 0 });
    assert.ok(page.items.length <= 100);
  });

  await t.test("update returns null for a missing id; delete returns false", async () => {
    assert.equal(await repo.update(crypto.randomUUID(), { title: "x" }), null);
    assert.equal(await repo.delete(crypto.randomUUID()), false);
  });

  await t.test("update + delete round trip", async () => {
    const rec = await repo.create({ ...baseInput, slug: `${tag}-rt`, caseNumber: `${tag}-RT` });
    const updated = await repo.update(rec.id, { title: "Renamed", priceUsd: 250 });
    assert.equal(updated?.title, "Renamed");
    assert.equal(updated?.priceUsd, 250);
    assert.equal(await repo.delete(rec.id), true);
    assert.equal(await repo.findById(rec.id), null);
  });
});
