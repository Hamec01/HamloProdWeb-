/**
 * Upload this free release to its own private object, without touching HPDG.
 * npx tsx --env-file=.env scripts/publish-hpdg808.mts /path/to/HPDG808_Setup_1.0.0.exe
 * Never overwrite an existing release; verify the stored bytes on every run.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { hpdg808Release as release } from "../src/lib/hpdg808/release";
import { getS3Config } from "../src/lib/storage/config";
import { ContaboS3Storage } from "../src/lib/storage/contabo-s3-storage";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Pass the path to HPDG808_Setup_1.0.0.exe.");
  const bytes = await readFile(filePath);
  if (bytes.byteLength !== release.size || createHash("sha256").update(bytes).digest("hex") !== release.sha256) {
    throw new Error("Installer size or SHA-256 does not match the verified release.");
  }
  console.log("PASS local installer size and SHA-256");
  const storage = new ContaboS3Storage(getS3Config());
  const object = { visibility: "private", key: release.objectKey } as const;
  if (!(await storage.headObject(object))) {
    await storage.putObject({
      ...object, body: bytes, contentType: "application/octet-stream", contentLength: bytes.byteLength,
    });
    console.log("PASS installer uploaded to its own private release key");
  } else {
    console.log("Existing release preserved; checking stored bytes");
  }
  const signed = await storage.createSignedDownloadUrl(object, { expiresInSeconds: 300, downloadName: release.fileName });
  const response = await fetch(signed.url);
  if (!response.ok) throw new Error(`Stored download failed: HTTP ${response.status}.`);
  const stored = Buffer.from(await response.arrayBuffer());
  if (stored.byteLength !== release.size || createHash("sha256").update(stored).digest("hex") !== release.sha256) {
    throw new Error("Stored installer does not match the verified release. Existing objects were not overwritten.");
  }
  console.log("PASS signed download, size and SHA-256");
}

main().catch((error: unknown) => {
  // Do not print SDK errors, signed URLs or credentials.
  console.error(error instanceof Error && !error.message.includes("http")
    ? error.message : "Publication failed. Check storage access and retry.");
  process.exitCode = 1;
});
