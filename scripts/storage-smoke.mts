/**
 * Live smoke test against the real Contabo Object Storage.
 *
 *   npx tsx scripts/storage-smoke.mts
 *
 * Checks:
 *   1. public  put  → anonymous GET returns 200 + correct body
 *   2. private put  → anonymous GET returns 401/403
 *   3. private      → server-created presigned GET returns 200 + correct body
 *   4. both test objects are deleted
 *   5. HeadObject after delete confirms both are gone
 *
 * Reads S3_* from the environment. Prints ONLY check names, HTTP status codes and
 * PASS/FAIL — never a signed URL, an access key, a secret, or env contents.
 * Exit code is 0 only when every check passes.
 */

import { randomUUID } from "node:crypto";
import { getS3Config } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";

const cfg = getS3Config();
const storage = new ContaboS3Storage(cfg);

const marker = randomUUID();
const publicKey = `smoke/${randomUUID()}.txt`;
const privateKey = `smoke/${randomUUID()}.bin`;
const publicBody = `public-${marker}`;
const publicBytes = Buffer.from(publicBody);
const privateBody = `private-${marker}`;
const privateBytes = Buffer.from(privateBody);

let passed = 0;
let total = 0;
function check(name: string, ok: boolean, detail: string) {
  total += 1;
  if (ok) passed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(34)} ${detail}`);
}

async function anonGet(url: string): Promise<{ status: number; text: string }> {
  const res = await fetch(url, { redirect: "manual" });
  return { status: res.status, text: res.status === 200 ? await res.text() : "" };
}

async function main() {
  console.log(`endpoint host: ${new URL(cfg.endpoint).host}  buckets: ${cfg.publicBucket} / ${cfg.privateBucket}\n`);

  // 1 — public put → anon GET 200
  await storage.putObject({
    visibility: "public",
    key: publicKey,
    body: publicBytes,
    contentType: "text/plain",
    contentLength: publicBytes.byteLength,
  });
  const pub = await anonGet(storage.getPublicUrl({ visibility: "public", key: publicKey }));
  check("public put → anonymous GET", pub.status === 200 && pub.text === publicBody, `status ${pub.status}${pub.status === 200 ? (pub.text === publicBody ? " body-ok" : " BODY-MISMATCH") : ""}`);

  // 2 — private put → anon GET 401/403
  await storage.putObject({
    visibility: "private",
    key: privateKey,
    body: privateBytes,
    contentType: "application/octet-stream",
    contentLength: privateBytes.byteLength,
  });
  const privAnon = await anonGet(`${cfg.endpoint}/${cfg.privateBucket}/${privateKey}`);
  check("private put → anonymous GET denied", privAnon.status === 401 || privAnon.status === 403, `status ${privAnon.status} (want 401/403)`);

  // 3 — private presigned GET 200
  const signed = await storage.createSignedDownloadUrl({ visibility: "private", key: privateKey }, { expiresInSeconds: 300 });
  const signedRes = await fetch(signed.url);
  const signedBody = signedRes.status === 200 ? await signedRes.text() : "";
  check("private presigned GET", signedRes.status === 200 && signedBody === privateBody, `status ${signedRes.status}${signedRes.status === 200 ? (signedBody === privateBody ? " body-ok" : " BODY-MISMATCH") : ""}`);

  // 4 — delete both
  await storage.deleteObject({ visibility: "public", key: publicKey });
  await storage.deleteObject({ visibility: "private", key: privateKey });
  check("delete both test objects", true, "done");

  // 5 — HeadObject after delete confirms absence
  const headPub = await storage.headObject({ visibility: "public", key: publicKey });
  const headPriv = await storage.headObject({ visibility: "private", key: privateKey });
  check("HeadObject after delete = absent", headPub === null && headPriv === null, `public ${headPub === null ? "gone" : "PRESENT"}, private ${headPriv === null ? "gone" : "PRESENT"}`);

  console.log(`\nSMOKE: ${passed}/${total} passed`);
  if (passed !== total) {
    console.log("Note: 'public put → anonymous GET' needs the hamloprod-public bucket policy");
    console.log("(anonymous s3:GetObject). See docs/storage-migration.md.");
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error("SMOKE ERROR:", error instanceof Error ? error.message : String(error));
  // best-effort cleanup
  await storage.deleteObject({ visibility: "public", key: publicKey }).catch(() => {});
  await storage.deleteObject({ visibility: "private", key: privateKey }).catch(() => {});
  process.exit(1);
});
