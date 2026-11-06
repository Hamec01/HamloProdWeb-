import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

test("update campaign: deduplicated buyers, receipt gate, concurrent sends, revocation and ambiguous failures", {
  skip: !process.env.HPDG_CAMPAIGN_TEST_DATABASE_URL,
}, async (t) => {
  const url = process.env.HPDG_CAMPAIGN_TEST_DATABASE_URL!;
  // Refuse to mutate any real application database.
  assert.equal(new URL(url).pathname, "/hpdg_beta7_test");
  process.env.DATABASE_URL = url;
  const { prisma } = await import("@/lib/db/client");
  const { prepareCampaign, campaignView, sendCampaign, confirmCampaignTest } = await import("./update-campaign");
  const { generateLicenseKey, licenseKeyHash } = await import("./license-key");
  const fetchBefore = globalThis.fetch;
  const apiKeyBefore = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "test-no-network";
  let calls = 0;
  let ambiguous = false;
  globalThis.fetch = (async () => {
    calls++;
    if (ambiguous) throw new Error("network interrupted");
    return Response.json({ id: randomUUID() });
  }) as typeof fetch;
  try {
    const release = await prisma.hpdgRelease.create({ data: {
      version: "0.1.0-beta.7", title: "Test Beta 7", notes: "Test notes", page: "https://hamloprod.org/en/vst",
      objectKey: "hpdg/test.exe", sha256: "a".repeat(64), size: 100, isCurrent: true,
    } });
    for (const [email, source, paid, revoked] of [
      ["buyer@example.com", "stripe", true, false], ["BUYER@example.com", "stripe-csv", true, false],
      ["second@example.com", "stripe", true, false], ["test@example.com", "manual", false, false],
      ["revoked@example.com", "stripe", true, true],
    ] as const) {
      const key = generateLicenseKey();
      await prisma.hpdgLicenseKey.create({ data: { key, keyHash: licenseKeyHash(key), email, source, stripePaymentId: paid ? randomUUID() : null, revokedAt: revoked ? new Date() : null } });
    }
    const adminId = randomUUID();
    await prepareCampaign({ releaseId: release.id, subject: "Beta 7", text: "The update is available. Thank you!" }, adminId);
    let view = await campaignView(release.id);
    assert.deepEqual(view.campaign!.recipients.map((r) => r.email), ["buyer@example.com", "second@example.com"]);
    await t.test("a second preparation preserves the original content and snapshot", async () => {
      await prepareCampaign({ releaseId: release.id, subject: "Changed", text: "Different" }, adminId);
      assert.equal((await campaignView(release.id)).campaign!.subject, "Beta 7");
    });
    await t.test("broadcast is blocked until actual test receipt is confirmed", async () => {
      await assert.rejects(sendCampaign(release.id), /тестового письма/);
      assert.equal(calls, 0);
      const id = randomUUID();
      await prisma.hpdgUpdateCampaign.update({ where: { releaseId: release.id }, data: { testEmail: "owner@example.com", testMessageId: id } });
      await confirmCampaignTest(release.id, id, adminId);
    });
    await t.test("concurrent double clicks and later retries send once per normalized address", async () => {
      await Promise.all([sendCampaign(release.id), sendCampaign(release.id)]);
      await sendCampaign(release.id);
      assert.equal(calls, 2);
      view = await campaignView(release.id);
      assert.ok(view.campaign!.recipients.every((r) => r.status === "accepted" && r.messageId));
    });
    await t.test("a revoked key after preparation is skipped", async () => {
      const recipient = view.campaign!.recipients[0];
      await prisma.hpdgUpdateRecipient.update({ where: { id: recipient.id }, data: { status: "pending" } });
      const row = await prisma.hpdgUpdateRecipient.findUniqueOrThrow({ where: { id: recipient.id } });
      await prisma.hpdgLicenseKey.update({ where: { id: row.licenseKeyId }, data: { revokedAt: new Date() } });
      await sendCampaign(release.id);
      assert.equal(calls, 2);
      assert.equal((await prisma.hpdgUpdateRecipient.findUniqueOrThrow({ where: { id: recipient.id } })).status, "skipped");
    });
    await t.test("a network timeout is never automatically resent", async () => {
      const recipient = view.campaign!.recipients[1];
      await prisma.hpdgUpdateRecipient.update({ where: { id: recipient.id }, data: { status: "pending", messageId: null } });
      ambiguous = true;
      await sendCampaign(release.id);
      await sendCampaign(release.id);
      assert.equal(calls, 3);
      assert.equal((await prisma.hpdgUpdateRecipient.findUniqueOrThrow({ where: { id: recipient.id } })).status, "unknown");
    });
    await t.test("rollback disables the old campaign", async () => {
      await prisma.hpdgRelease.update({ where: { id: release.id }, data: { isCurrent: false } });
      await assert.rejects(sendCampaign(release.id), /больше не текущий/);
    });
  } finally {
    globalThis.fetch = fetchBefore;
    if (apiKeyBefore === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = apiKeyBefore;
    await prisma.hpdgUpdateRecipient.deleteMany();
    await prisma.hpdgUpdateCampaign.deleteMany();
    await prisma.hpdgLicenseKey.deleteMany();
    await prisma.hpdgRelease.deleteMany();
    await prisma.$disconnect();
  }
});
