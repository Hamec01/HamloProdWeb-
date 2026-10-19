/**
 * POST /api/hpdg/download decision logic. Pure — every side effect is a port, so
 * the contract the plugin relies on is unit-tested without a database.
 *
 * Order: IP block → key format → key lookup (constant-time compare) → revoked →
 * platform / release → sign → daily ticket limit.
 *   429 rate_limited  — IP blocked after too many failed attempts, or 5 tickets / 24 h used
 *   401 invalid_key   — malformed or unknown key (counts as a failed attempt)
 *   403 invalid_key   — revoked / refunded key (counts as a failed attempt)
 *   404 no_release    — no current release for the platform
 */

import { keysEqual, licenseKeyHash, normalizeLicenseKey } from "./license-key";
import { HPDG_PLATFORM, parseVersion } from "./release";

export const DAILY_TICKET_LIMIT = 5;
export const INSTALLER_URL_TTL_SECONDS = 600;

export type CurrentRelease = { version: string; objectKey: string; sha256: string; size: number };

export type DownloadPorts = {
  isIpBlocked(ip: string): Promise<boolean>;
  recordIpFailure(ip: string): Promise<void>;
  findKeyByHash(keyHash: string): Promise<{ id: string; key: string; revokedAt: Date | null } | null>;
  currentRelease(platform: string): Promise<CurrentRelease | null>;
  signInstallerUrl(objectKey: string): Promise<string>;
  /** Atomically: false when the key already has `limit` tickets in the last 24 h, else log one and return true. */
  reserveTicket(input: { licenseKeyId: string; version: string; currentVersion: string | null; ipCountry: string | null; limit: number }): Promise<boolean>;
};

export type DownloadResult = { status: number; body: Record<string, unknown> };

const invalidKey = (status: 401 | 403): DownloadResult => ({ status, body: { error: "invalid_key" } });
const rateLimited: DownloadResult = { status: 429, body: { error: "rate_limited" } };
const noRelease: DownloadResult = { status: 404, body: { error: "no_release" } };

function field(body: unknown, name: string): unknown {
  return body && typeof body === "object" ? (body as Record<string, unknown>)[name] : undefined;
}

export async function handleDownloadRequest(
  body: unknown,
  client: { ip: string; country: string | null },
  ports: DownloadPorts,
): Promise<DownloadResult> {
  if (await ports.isIpBlocked(client.ip)) return rateLimited;

  const key = normalizeLicenseKey(field(body, "licenseKey"));
  if (!key) {
    await ports.recordIpFailure(client.ip);
    return invalidKey(401);
  }

  const row = await ports.findKeyByHash(licenseKeyHash(key));
  if (!row || !keysEqual(row.key, key)) {
    await ports.recordIpFailure(client.ip);
    return invalidKey(401);
  }
  if (row.revokedAt) {
    await ports.recordIpFailure(client.ip);
    return invalidKey(403);
  }

  const platform = field(body, "platform") ?? HPDG_PLATFORM;
  if (platform !== HPDG_PLATFORM) return noRelease;

  const release = await ports.currentRelease(HPDG_PLATFORM);
  if (!release) return noRelease;

  const rawCurrent = field(body, "currentVersion");
  const currentVersion = typeof rawCurrent === "string" && parseVersion(rawCurrent) ? rawCurrent : null;

  const url = await ports.signInstallerUrl(release.objectKey);
  const reserved = await ports.reserveTicket({
    licenseKeyId: row.id,
    version: release.version,
    currentVersion,
    ipCountry: client.country,
    limit: DAILY_TICKET_LIMIT,
  });
  if (!reserved) return rateLimited;

  return { status: 200, body: { url, sha256: release.sha256, version: release.version, size: release.size } };
}
