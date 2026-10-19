/**
 * Server-only adapters for HPDG keys / releases / download tickets.
 * The per-IP failed-attempt counter reuses the `auth_throttle` table under its own
 * HMAC namespace (`hpdg-download:ip:`), so plaintext IPs are never stored.
 */

import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getSessionSecret } from "@/lib/auth/config";
import { getS3Config } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { INSTALLER_URL_TTL_SECONDS, type DownloadPorts } from "./download-service";
import { generateLicenseKey, licenseKeyHash } from "./license-key";
import { HPDG_OBJECT_PREFIX } from "./release";

export const IP_MAX_FAILURES = 20;
const IP_WINDOW = "60 minutes";
const IP_BLOCK = "60 minutes";

function ipKey(ip: string): string {
  return createHmac("sha256", getSessionSecret()).update(`hpdg-download:ip:${ip || "unknown"}`).digest("hex");
}

export const postgresDownloadPorts: DownloadPorts = {
  async isIpBlocked(ip) {
    const row = await prisma.authThrottle.findFirst({ where: { keyHash: ipKey(ip), blockedUntil: { gt: new Date() } }, select: { id: true } });
    return Boolean(row);
  },

  async recordIpFailure(ip) {
    await prisma.$executeRaw`
      INSERT INTO auth_throttle (id, key_hash, attempts, window_started_at, blocked_until, updated_at)
      VALUES (gen_random_uuid(), ${ipKey(ip)}, 1, now(), NULL, now())
      ON CONFLICT (key_hash) DO UPDATE SET
        attempts = CASE WHEN auth_throttle.window_started_at < now() - ${IP_WINDOW}::interval THEN 1 ELSE auth_throttle.attempts + 1 END,
        window_started_at = CASE WHEN auth_throttle.window_started_at < now() - ${IP_WINDOW}::interval THEN now() ELSE auth_throttle.window_started_at END,
        blocked_until = CASE
          WHEN (CASE WHEN auth_throttle.window_started_at < now() - ${IP_WINDOW}::interval THEN 1 ELSE auth_throttle.attempts + 1 END) >= ${IP_MAX_FAILURES}
          THEN now() + ${IP_BLOCK}::interval
          ELSE auth_throttle.blocked_until
        END,
        updated_at = now()
    `;
  },

  findKeyByHash(keyHash) {
    return prisma.hpdgLicenseKey.findUnique({ where: { keyHash }, select: { id: true, key: true, revokedAt: true } });
  },

  currentRelease(platform) {
    return prisma.hpdgRelease.findFirst({
      where: { isCurrent: true, platform },
      select: { version: true, objectKey: true, sha256: true, size: true },
    });
  },

  async signInstallerUrl(objectKey) {
    if (!objectKey.startsWith(HPDG_OBJECT_PREFIX) || objectKey.slice(HPDG_OBJECT_PREFIX.length).includes("/")) {
      throw new Error("Installer object key must be one file directly under hpdg/.");
    }
    const storage = new ContaboS3Storage(getS3Config());
    const signed = await storage.createSignedDownloadUrl(
      { visibility: "private", key: objectKey },
      { expiresInSeconds: INSTALLER_URL_TTL_SECONDS, downloadName: objectKey.slice(HPDG_OBJECT_PREFIX.length) },
    );
    return signed.url;
  },

  reserveTicket({ licenseKeyId, version, currentVersion, ipCountry, limit }) {
    return prisma.$transaction(async (tx) => {
      // Row lock serialises concurrent requests for the same key.
      await tx.$queryRaw`SELECT id FROM hpdg_license_keys WHERE id = ${licenseKeyId}::uuid FOR UPDATE`;
      const used = await tx.hpdgDownload.count({ where: { licenseKeyId, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
      if (used >= limit) return false;
      await tx.hpdgDownload.create({ data: { licenseKeyId, version, currentVersion, ipCountry } });
      return true;
    });
  },
};

// --- admin: keys ---------------------------------------------------------------

export type IssueRequest = {
  email: string;
  note?: string | null;
  source: "manual" | "stripe-csv";
  stripePaymentId?: string | null;
  stripeCustomerId?: string | null;
};

export type IssueOutcome =
  | { email: string; status: "issued"; key: string }
  | { email: string; status: "skipped"; reason: "has_active_key" | "payment_already_imported"; key?: string };

/**
 * One active key per email: an email that already has a non-revoked key is
 * skipped (the existing key is returned so it can be resent). A Stripe payment id
 * is imported at most once.
 */
export async function issueLicenseKeys(requests: IssueRequest[], createdById: string | null): Promise<IssueOutcome[]> {
  const outcomes: IssueOutcome[] = [];
  for (const request of requests) {
    const email = request.email.trim().toLowerCase();
    if (request.stripePaymentId) {
      const imported = await prisma.hpdgLicenseKey.findUnique({ where: { stripePaymentId: request.stripePaymentId }, select: { key: true } });
      if (imported) { outcomes.push({ email, status: "skipped", reason: "payment_already_imported", key: imported.key }); continue; }
    }
    const active = await prisma.hpdgLicenseKey.findFirst({ where: { email, revokedAt: null }, select: { key: true } });
    if (active) { outcomes.push({ email, status: "skipped", reason: "has_active_key", key: active.key }); continue; }

    for (let attempt = 0; ; attempt += 1) {
      const key = generateLicenseKey();
      try {
        await prisma.hpdgLicenseKey.create({
          data: {
            key,
            keyHash: licenseKeyHash(key),
            email,
            source: request.source,
            note: request.note?.trim() || null,
            stripePaymentId: request.stripePaymentId || null,
            stripeCustomerId: request.stripeCustomerId || null,
            createdById,
          },
        });
        outcomes.push({ email, status: "issued", key });
        break;
      } catch (error) {
        // A random 80-bit collision is practically impossible; retry once or twice anyway.
        if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
        throw error;
      }
    }
  }
  return outcomes;
}

export async function setLicenseKeyRevoked(id: string, revoked: boolean, reason: string | null) {
  return prisma.hpdgLicenseKey.update({
    where: { id },
    data: revoked ? { revokedAt: new Date(), revokedReason: reason?.trim() || null } : { revokedAt: null, revokedReason: null },
    select: { id: true },
  });
}

export type AdminLicenseKey = {
  id: string;
  key: string;
  email: string;
  source: string;
  note: string | null;
  stripePaymentId: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  downloads: number;
  downloads24h: number;
  lastDownloadAt: string | null;
  lastVersion: string | null;
};

export async function listLicenseKeys(): Promise<AdminLicenseKey[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [keys, recent] = await Promise.all([
    prisma.hpdgLicenseKey.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { downloads: true } }, downloads: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, version: true } } },
    }),
    prisma.hpdgDownload.groupBy({ by: ["licenseKeyId"], where: { createdAt: { gt: since } }, _count: { _all: true } }),
  ]);
  const recentByKey = new Map(recent.map((row) => [row.licenseKeyId, row._count._all]));
  return keys.map((row) => ({
    id: row.id,
    key: row.key,
    email: row.email,
    source: row.source,
    note: row.note,
    stripePaymentId: row.stripePaymentId,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokedReason: row.revokedReason,
    createdAt: row.createdAt.toISOString(),
    downloads: row._count.downloads,
    downloads24h: recentByKey.get(row.id) ?? 0,
    lastDownloadAt: row.downloads[0]?.createdAt.toISOString() ?? null,
    lastVersion: row.downloads[0]?.version ?? null,
  }));
}

// --- admin: releases -------------------------------------------------------------

export type AdminHpdgRelease = {
  id: string;
  version: string;
  title: string;
  notes: string;
  page: string;
  objectKey: string;
  sha256: string;
  size: number;
  isCurrent: boolean;
  createdAt: string;
};

export async function listReleases(): Promise<AdminHpdgRelease[]> {
  const rows = await prisma.hpdgRelease.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    title: row.title,
    notes: row.notes,
    page: row.page,
    objectKey: row.objectKey,
    sha256: row.sha256,
    size: row.size,
    isCurrent: row.isCurrent,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function makeReleaseCurrent(id: string) {
  await prisma.$transaction([
    prisma.hpdgRelease.updateMany({ where: { isCurrent: true, NOT: { id } }, data: { isCurrent: false } }),
    prisma.hpdgRelease.update({ where: { id }, data: { isCurrent: true } }),
  ]);
}
