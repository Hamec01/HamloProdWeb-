import test from "node:test";
import assert from "node:assert/strict";
import { handleDownloadRequest, type DownloadPorts } from "./download-service";
import { licenseKeyHash } from "./license-key";

const KEY = "HPDG-7K3M-2Q9X-ABCD-EF01";
const RELEASE = { version: "0.1.0-beta.4", objectKey: "hpdg/HPDG_VST3_Setup_0.1.0-beta.4.exe", sha256: "a".repeat(64), size: 113853262 };
const CLIENT = { ip: "203.0.113.7", country: "FI" };

function fakePorts(overrides: Partial<{ revoked: boolean; release: typeof RELEASE | null; blocked: boolean; used: number }> = {}) {
  const state = { failures: 0, tickets: [] as unknown[], used: overrides.used ?? 0, signed: [] as string[] };
  const ports: DownloadPorts = {
    isIpBlocked: async () => overrides.blocked ?? false,
    recordIpFailure: async () => { state.failures += 1; },
    findKeyByHash: async (hash) => (hash === licenseKeyHash(KEY) ? { id: "k1", key: KEY, revokedAt: overrides.revoked ? new Date() : null } : null),
    currentRelease: async () => (overrides.release === undefined ? RELEASE : overrides.release),
    signInstallerUrl: async (objectKey) => { state.signed.push(objectKey); return `https://usc1.contabostorage.com/hamloprod-private/${objectKey}?X-Amz-Signature=x`; },
    reserveTicket: async (input) => {
      if (state.used >= input.limit) return false;
      state.used += 1;
      state.tickets.push(input);
      return true;
    },
  };
  return { ports, state };
}

test("valid key (any spelling) → 200 with url, sha256, version, size and a logged ticket", async () => {
  const { ports, state } = fakePorts();
  const result = await handleDownloadRequest({ licenseKey: "hpdg 7k3m 2q9x abcd ef0i", currentVersion: "0.1.0-beta.3", platform: "windows-x64" }, CLIENT, ports);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    url: "https://usc1.contabostorage.com/hamloprod-private/hpdg/HPDG_VST3_Setup_0.1.0-beta.4.exe?X-Amz-Signature=x",
    sha256: RELEASE.sha256,
    version: RELEASE.version,
    size: RELEASE.size,
  });
  assert.deepEqual(state.tickets, [{ licenseKeyId: "k1", version: "0.1.0-beta.4", currentVersion: "0.1.0-beta.3", ipCountry: "FI", limit: 5 }]);
  assert.equal(state.failures, 0);
});

test("malformed or unknown key → 401 and a failed attempt for the IP", async () => {
  for (const licenseKey of [undefined, "", "nope", "HPDG-0000-0000-0000-0000"]) {
    const { ports, state } = fakePorts();
    const result = await handleDownloadRequest({ licenseKey }, CLIENT, ports);
    assert.deepEqual(result, { status: 401, body: { error: "invalid_key" } }, String(licenseKey));
    assert.equal(state.failures, 1);
    assert.equal(state.signed.length, 0);
  }
});

test("revoked key → 403", async () => {
  const { ports, state } = fakePorts({ revoked: true });
  assert.deepEqual(await handleDownloadRequest({ licenseKey: KEY }, CLIENT, ports), { status: 403, body: { error: "invalid_key" } });
  assert.equal(state.failures, 1);
});

test("blocked IP → 429 before the key is even looked at", async () => {
  const { ports, state } = fakePorts({ blocked: true });
  assert.deepEqual(await handleDownloadRequest({ licenseKey: KEY }, CLIENT, ports), { status: 429, body: { error: "rate_limited" } });
  assert.equal(state.failures, 0);
});

test("no current release or other platform → 404", async () => {
  assert.deepEqual(await handleDownloadRequest({ licenseKey: KEY }, CLIENT, fakePorts({ release: null }).ports), { status: 404, body: { error: "no_release" } });
  assert.deepEqual(await handleDownloadRequest({ licenseKey: KEY, platform: "macos-arm64" }, CLIENT, fakePorts().ports), { status: 404, body: { error: "no_release" } });
});

test("6th ticket within 24 h → 429; a garbage currentVersion is logged as null", async () => {
  const { ports, state } = fakePorts();
  for (let i = 0; i < 5; i += 1) assert.equal((await handleDownloadRequest({ licenseKey: KEY, currentVersion: "lol" }, CLIENT, ports)).status, 200);
  assert.deepEqual(await handleDownloadRequest({ licenseKey: KEY }, CLIENT, ports), { status: 429, body: { error: "rate_limited" } });
  assert.equal((state.tickets[0] as { currentVersion: unknown }).currentVersion, null);
});
