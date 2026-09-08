import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db/client";
import { PrismaUploadIntentRepository } from "./upload-intent.postgres";
import { BeatService } from "@/lib/beats/service";
import { generateObjectKey } from "@/lib/storage/keys";
import { sweepUploads } from "@/lib/storage/cleanup";
import type { BeatAssetKind } from "@/lib/data/repositories/upload-intent.repository";

test("UploadIntent lifecycle and transactional attachment", { skip: !process.env.DATABASE_URL }, async t => {
  const tag = `m72-${crypto.randomUUID()}`;
  const owner = await prisma.user.create({ data: { email: `${tag}@example.invalid`, role: "ADMIN" } });
  const beat = await prisma.beat.create({ data: { slug: tag, caseNumber: tag, title: "Upload test", genre: "trap", priceUsd: 1, priceRub: 1 } });
  // Constrain sweep queries to this fixture owner even when DATABASE_URL is shared.
  const scoped = prisma.$extends({ query: { uploadIntent: { async findMany({ args, query }) {
    args.where = { AND: [args.where ?? {}, { ownerId: owner.id }] };
    return query(args);
  } } } });
  const repo = new PrismaUploadIntentRepository(scoped as unknown as typeof prisma);
  const service = new BeatService(undefined, repo);
  t.after(async () => { await prisma.beat.delete({ where: { id: beat.id } }); await prisma.user.delete({ where: { id: owner.id } }); });
  async function pending(kind: BeatAssetKind = "beat-cover", expiresAt = new Date(Date.now() + 300_000)) {
    const key = generateObjectKey({ kind, entityId: beat.id, originalFileName: "test.png" }).key;
    await repo.createPending({ ownerId: owner.id, entityType: "beat", entityId: beat.id, kind, key, visibility: "public", contentType: "image/png", expectedSize: 10, expiresAt });
    return key;
  }
  await t.test("PENDING, finalize CAS, attached CAS", async () => {
    const key = await pending();
    assert.equal((await repo.findByKey(key))?.state, "PENDING");
    assert.equal(await repo.markAttached(key), false);
    assert.equal(await repo.markFinalized(key, 10), true);
    assert.equal(await repo.markFinalized(key, 10), false);
    assert.equal((await repo.findByKey(key))?.actualSize, 10);
    assert.ok((await repo.findByKey(key))?.finalizedAt);
    assert.equal(await repo.markAttached(key), true);
    assert.equal(await repo.markAttached(key), false);
  });
  await t.test("attach rejects owner, entity, kind and unfinalized keys", async () => {
    const key = await pending();
    assert.equal((await service.attachAsset(beat.id, "beat-cover", key, "ADMIN", owner.id)).ok, false);
    await repo.markFinalized(key, 10);
    const foreign = await service.attachAsset(beat.id, "beat-cover", key, "ADMIN", crypto.randomUUID());
    assert.equal(foreign.ok, false);
    if (!foreign.ok) assert.equal(foreign.status, 403);
    assert.equal((await service.attachAsset(crypto.randomUUID(), "beat-cover", key, "ADMIN", owner.id)).ok, false);
    assert.equal((await service.attachAsset(beat.id, "beat-master", key, "ADMIN", owner.id)).ok, false);
    await prisma.uploadIntent.update({ where: { key }, data: { entityId: crypto.randomUUID() } });
    assert.equal((await service.attachAsset(beat.id, "beat-cover", key, "ADMIN", owner.id)).ok, false);
    assert.equal(await repo.attachBeatAsset(beat.id, "beat-cover", key, owner.id), null);
  });
  await t.test("concurrent replacements serialize and mark only displaced keys DELETING", async () => {
    const keys = await Promise.all([pending(), pending(), pending()]);
    for (const key of keys) await repo.markFinalized(key, 10);
    const results = await Promise.all(keys.map(key => repo.attachBeatAsset(beat.id, "beat-cover", key, owner.id)));
    assert.ok(results.every(Boolean));
    const current = (await prisma.beat.findUniqueOrThrow({ where: { id: beat.id } })).coverKey;
    for (const key of keys) assert.equal((await repo.findByKey(key))?.state, key === current ? "ATTACHED" : "DELETING");
    assert.equal(await repo.attachBeatAsset(beat.id, "beat-cover", current!, owner.id), null);
  });
  await t.test("stale expiry, retry after S3 failure, attached preservation", async () => {
    // Recently displaced keys must wait for any outstanding signed PUT to expire.
    const recent = await prisma.uploadIntent.findFirst({ where: { ownerId: owner.id, state: "DELETING" } });
    assert.ok(recent && recent.expiresAt > new Date());
    const expired = await pending("beat-cover", new Date(Date.now() - 7200_000));
    const fresh = await pending();
    assert.equal(await repo.markFinalized(expired, 10), false);
    await sweepUploads(repo, { async deleteObject() { throw new Error("offline"); } });
    assert.equal((await repo.findByKey(expired))?.state, "DELETING");
    const deleted: string[] = [];
    await sweepUploads(repo, { async deleteObject(object) { deleted.push(object.key); } });
    assert.ok(deleted.includes(expired));
    assert.ok(!deleted.includes(recent.key));
    assert.equal((await repo.findByKey(expired))?.state, "EXPIRED");
    assert.equal((await repo.findByKey(fresh))?.state, "PENDING");
    const current = (await prisma.beat.findUniqueOrThrow({ where: { id: beat.id } })).coverKey;
    assert.ok(!deleted.includes(current!));
  });
});
