import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getMailConfig } from "./key-email";
import { buildUpdateEmail, defaultUpdateEmail, eligibleBuyer, retrieveDelivery, sendUpdateEmail, UpdateSendError } from "./update-email";

export class CampaignError extends Error {}

export async function campaignView(releaseId: string) {
  const [release, campaign, keys] = await Promise.all([
    prisma.hpdgRelease.findUniqueOrThrow({ where: { id: releaseId } }),
    prisma.hpdgUpdateCampaign.findUnique({ where: { releaseId }, include: { recipients: { orderBy: { email: "asc" } } } }),
    prisma.hpdgLicenseKey.findMany({ where: { revokedAt: null, source: { in: ["stripe", "stripe-csv"] }, stripePaymentId: { not: null } }, select: { email: true } }),
  ]);
  return {
    releaseId, version: release.version, isCurrent: release.isCurrent,
    draft: defaultUpdateEmail(release),
    eligibleEmails: [...new Set(keys.map((k) => k.email.trim().toLowerCase()))],
    campaign: campaign ? {
      id: campaign.id, subject: campaign.subject, text: campaign.text,
      testEmail: campaign.testEmail, testMessageId: campaign.testMessageId,
      testConfirmedAt: campaign.testConfirmedAt?.toISOString() ?? null,
      recipients: campaign.recipients.map((r) => ({
        id: r.id, email: r.email, status: r.status, messageId: r.messageId, error: r.error,
        acceptedAt: r.acceptedAt?.toISOString() ?? null,
      })),
    } : null,
  };
}

export type CampaignView = Awaited<ReturnType<typeof campaignView>>;

export async function prepareCampaign(input: { releaseId: string; subject: string; text: string }, adminId: string) {
  await prisma.$transaction(async (tx) => {
    // Serialise preparation: a release can have exactly one immutable campaign.
    await tx.$queryRaw`SELECT id FROM hpdg_releases WHERE id = ${input.releaseId}::uuid FOR UPDATE`;
    const release = await tx.hpdgRelease.findUniqueOrThrow({ where: { id: input.releaseId } });
    if (!release.isCurrent) throw new CampaignError("Сначала опубликуй релиз и сделай его текущим.");
    if (await tx.hpdgUpdateCampaign.findUnique({ where: { releaseId: input.releaseId } })) return;
    const keys = await tx.hpdgLicenseKey.findMany({
      where: { revokedAt: null, source: { in: ["stripe", "stripe-csv"] }, stripePaymentId: { not: null } },
      orderBy: { createdAt: "asc" }, select: { id: true, email: true },
    });
    const recipients = new Map<string, string>();
    for (const key of keys) recipients.set(key.email.trim().toLowerCase(), key.id);
    if (!recipients.size) throw new CampaignError("Нет покупателей с активными ключами.");
    await tx.hpdgUpdateCampaign.create({ data: {
      ...input, version: release.version, createdById: adminId,
      recipients: { create: [...recipients].map(([email, licenseKeyId]) => ({ email, licenseKeyId })) },
    } });
  });
}

async function currentCampaign(releaseId: string) {
  const campaign = await prisma.hpdgUpdateCampaign.findUniqueOrThrow({ where: { releaseId } });
  const release = await prisma.hpdgRelease.findUniqueOrThrow({ where: { id: releaseId } });
  if (!release.isCurrent) throw new CampaignError("Этот релиз больше не текущий. Отправка отключена.");
  return campaign;
}

export async function testCampaign(releaseId: string, email: string) {
  const campaign = await currentCampaign(releaseId);
  if (campaign.testEmail === email && campaign.testMessageId) return;
  const config = getMailConfig();
  const addressHash = createHash("sha256").update(email).digest("hex");
  const messageId = await sendUpdateEmail(email, buildUpdateEmail(campaign), config, `hpdg-update-test/${campaign.id}/${addressHash}`);
  await prisma.hpdgUpdateCampaign.update({ where: { id: campaign.id }, data: {
    testEmail: email, testMessageId: messageId, testConfirmedAt: null, testConfirmedById: null,
  } });
}

/** Owner confirms actual receipt of the exact, immutable email tested above. */
export async function confirmCampaignTest(releaseId: string, messageId: string, adminId: string) {
  const result = await prisma.hpdgUpdateCampaign.updateMany({
    where: { releaseId, testMessageId: messageId },
    data: { testConfirmedAt: new Date(), testConfirmedById: adminId },
  });
  if (!result.count) throw new CampaignError("Сначала отправь и получи тестовое письмо.");
}

/** At most five sequential recipients per click. A DB claim handles concurrent clicks.
 * Once accepted, a recipient is excluded permanently, beyond Resend's 24h window.
 * Interrupted/ambiguous sends remain blocked for manual provider reconciliation.
 */
export async function sendCampaign(releaseId: string) {
  const campaign = await currentCampaign(releaseId);
  if (!campaign.testConfirmedAt) throw new CampaignError("Подтверди получение тестового письма перед рассылкой.");
  const config = getMailConfig();
  const recipients = await prisma.hpdgUpdateRecipient.findMany({
    where: { campaignId: campaign.id, status: { in: ["pending", "rejected"] } }, orderBy: { id: "asc" }, take: 5,
  });
  for (const recipient of recipients) {
    const claimed = await prisma.$transaction(async (tx) => {
      const key = await tx.hpdgLicenseKey.findUnique({ where: { id: recipient.licenseKeyId } });
      const active = key && eligibleBuyer(key);
      return tx.hpdgUpdateRecipient.updateMany({
        where: { id: recipient.id, status: { in: ["pending", "rejected"] } },
        data: active ? { status: "sending", attemptedAt: new Date(), error: null } : { status: "skipped", error: "Ключ отозван или покупка больше не активна." },
      }).then((r) => Boolean(r.count && active));
    });
    if (!claimed) continue;
    let messageId: string;
    try {
      messageId = await sendUpdateEmail(recipient.email, buildUpdateEmail(campaign), config, `hpdg-update/${campaign.id}/${recipient.id}`);
    } catch (error) {
      await prisma.hpdgUpdateRecipient.update({ where: { id: recipient.id }, data: {
        status: error instanceof UpdateSendError && !error.uncertain ? "rejected" : "unknown",
        error: error instanceof UpdateSendError ? error.message : "Результат неизвестен. Проверь Resend перед любыми повторами.",
      } });
      // Do not try every recipient if the provider is unavailable or credentials are wrong.
      break;
    }
    // Outside the send catch: if DB persistence fails, keep 'sending', never 'failed'.
    await prisma.hpdgUpdateRecipient.update({ where: { id: recipient.id }, data: { status: "accepted", messageId, acceptedAt: new Date() } });
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
}

export async function refreshCampaignDelivery(releaseId: string) {
  const campaign = await prisma.hpdgUpdateCampaign.findUniqueOrThrow({ where: { releaseId } });
  const config = getMailConfig();
  const rows = await prisma.hpdgUpdateRecipient.findMany({
    where: { campaignId: campaign.id, messageId: { not: null }, status: "accepted" }, take: 5,
  });
  for (const row of rows) {
    const status = await retrieveDelivery(row.messageId!, config.apiKey);
    await prisma.hpdgUpdateRecipient.update({ where: { id: row.id }, data: { status } });
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
}
