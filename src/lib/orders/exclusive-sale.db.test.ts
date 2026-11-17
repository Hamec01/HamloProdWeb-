import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { lockBeatForExclusiveSale } from "./exclusive-sale";

const CONFIGURED = Boolean(process.env.DATABASE_URL);

test("exclusive sale lock allows exactly one concurrent activation", { skip: !CONFIGURED && "no DATABASE_URL" }, async (t) => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const beat = await prisma.beat.create({
    data: {
      slug: `sale-lock-${suffix}`,
      caseNumber: `SALE-${suffix}`,
      title: "Exclusive sale lock test",
      genre: "trap",
      priceUsd: 100,
      priceRub: 2500,
      status: "available",
    },
  });
  t.after(async () => {
    await prisma.beat.delete({ where: { id: beat.id } });
  });

  const activations = await Promise.all([
    prisma.$transaction((tx) => lockBeatForExclusiveSale(tx, beat.id)),
    prisma.$transaction((tx) => lockBeatForExclusiveSale(tx, beat.id)),
  ]);
  assert.equal(activations.filter(Boolean).length, 1);
  assert.equal((await prisma.beat.findUniqueOrThrow({ where: { id: beat.id } })).status, "sold");
});
