/** Stage a verified HPDG installer privately; activate only with --activate.
 * npx tsx --env-file=.env scripts/publish-hpdg-package.mts /private/package/path [--activate]
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../src/lib/db/client";
import { getS3Config } from "../src/lib/storage/config";
import { installerObjectKey, releaseInputSchema } from "../src/lib/hpdg/release";
import { makeReleaseCurrent } from "../src/lib/hpdg/postgres";

const directory = process.argv[2];
if (!directory || process.argv.slice(3).some((a) => a !== "--activate")) throw new Error("Pass the package directory and optionally --activate.");
const raw = JSON.parse(await readFile(join(directory, "release.json"), "utf8"));
const input = releaseInputSchema.parse({ ...raw, fileName: basename(raw.objectKey), makeCurrent: false });
if (installerObjectKey(input.fileName) !== raw.objectKey) throw new Error("Unexpected object key.");
const file = await readFile(join(directory, input.fileName));
if (file.length !== input.size || createHash("sha256").update(file).digest("hex") !== input.sha256) throw new Error("Installer size or SHA-256 mismatch.");
const cfg = getS3Config();
const storage = new S3Client({ endpoint: cfg.endpoint, region: cfg.region, forcePathStyle: cfg.forcePathStyle, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } });
try {
  let exists = false;
  try { await storage.send(new HeadObjectCommand({ Bucket: cfg.privateBucket, Key: raw.objectKey })); exists = true; }
  catch (error) { if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw new Error("Could not inspect private object."); }
  if (!exists) await storage.send(new PutObjectCommand({ Bucket: cfg.privateBucket, Key: raw.objectKey, Body: file, ContentType: "application/octet-stream" }));
  const downloaded = await storage.send(new GetObjectCommand({ Bucket: cfg.privateBucket, Key: raw.objectKey }));
  const hash = createHash("sha256"); let size = 0;
  for await (const chunk of downloaded.Body as AsyncIterable<Uint8Array>) { hash.update(chunk); size += chunk.length; }
  if (size !== input.size || hash.digest("hex") !== input.sha256) throw new Error("Stored installer did not pass download verification.");
  const existing = await prisma.hpdgRelease.findUnique({ where: { version: input.version } });
  if (existing && (existing.sha256 !== input.sha256 || existing.size !== input.size || existing.objectKey !== raw.objectKey)) throw new Error("This version already has different release metadata. Refusing to replace it.");
  const release = existing ?? await prisma.hpdgRelease.create({ data: {
    version: input.version, title: input.title, notes: input.notes, page: input.page,
    objectKey: raw.objectKey, sha256: input.sha256, size: input.size,
  } });
  if (process.argv.includes("--activate")) await makeReleaseCurrent(release.id);
  console.log(JSON.stringify({ version: input.version, size, sha256: input.sha256, storedDownloadVerified: true, activated: process.argv.includes("--activate"), releaseId: release.id }));
} finally { storage.destroy(); await prisma.$disconnect(); }
