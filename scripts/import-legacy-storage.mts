/**
 * Import an extracted Supabase Storage backup into Contabo without overwriting.
 *
 * Old bucket namespaces are retained below `legacy-supabase/` so database URLs
 * can be rewritten deterministically after the Supabase data export is loaded.
 * A JSONL manifest records a SHA-256 digest for every source object.
 *
 * Usage:
 *   npx tsx scripts/import-legacy-storage.mts <source-dir> <manifest.jsonl> --dry-run
 *   npx tsx scripts/import-legacy-storage.mts <source-dir> <manifest.jsonl> --upload
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getS3Config } from "@/lib/storage/config";

const PUBLIC_BUCKETS = new Set(["beat-previews", "media-images", "post-files"]);
const PRIVATE_BUCKETS = new Set(["track-downloads", "beat-downloads", "contracts-pdf"]);

type ManifestEntry = {
  source: string;
  visibility: "public" | "private";
  targetBucket: string;
  key: string;
  size: number;
  sha256: string;
  contentType: string;
};

function contentType(file: string): string {
  switch (path.extname(file).toLowerCase()) {
    case ".mp3": return "audio/mpeg";
    case ".mp4": return "audio/mp4";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".exe": return "application/vnd.microsoft.portable-executable";
    case ".wav": return "audio/wav";
    case ".zip": return "application/zip";
    case ".pdf": return "application/pdf";
    default: return "application/octet-stream";
  }
}

async function filesBelow(root: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(dir: string) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) await visit(full);
      else if (item.isFile()) result.push(full);
      else throw new Error(`Unsupported filesystem entry: ${full}`);
    }
  }
  await visit(root);
  return result.sort();
}

async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

function parseTarget(root: string, file: string, cfg: ReturnType<typeof getS3Config>) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  const [oldBucket, ...objectParts] = relative.split("/");
  if (!oldBucket || objectParts.length === 0 || objectParts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Invalid backup path: ${relative}`);
  }
  const visibility = PUBLIC_BUCKETS.has(oldBucket)
    ? "public"
    : PRIVATE_BUCKETS.has(oldBucket)
      ? "private"
      : null;
  if (!visibility) throw new Error(`Unknown Supabase bucket: ${oldBucket}`);
  const key = `legacy-supabase/${oldBucket}/${objectParts.join("/")}`;
  return { relative, visibility, key, targetBucket: visibility === "public" ? cfg.publicBucket : cfg.privateBucket } as const;
}

const [sourceArg, manifestArg, mode] = process.argv.slice(2);
if (!sourceArg || !manifestArg || !["--dry-run", "--upload"].includes(mode)) {
  throw new Error("Usage: import-legacy-storage.mts <source-dir> <manifest.jsonl> (--dry-run|--upload)");
}

const sourceRoot = path.resolve(sourceArg);
const manifestPath = path.resolve(manifestArg);
const cfg = getS3Config();
const sourceFiles = await filesBelow(sourceRoot);
const manifest: ManifestEntry[] = [];

for (let index = 0; index < sourceFiles.length; index++) {
  const file = sourceFiles[index];
  const target = parseTarget(sourceRoot, file, cfg);
  const info = await stat(file);
  manifest.push({
    source: target.relative,
    visibility: target.visibility,
    targetBucket: target.targetBucket,
    key: target.key,
    size: info.size,
    sha256: await sha256(file),
    contentType: contentType(file),
  });
  if ((index + 1) % 50 === 0 || index + 1 === sourceFiles.length) {
    console.log(`hashed ${index + 1}/${sourceFiles.length}`);
  }
}

await writeFile(manifestPath, manifest.map((entry) => JSON.stringify(entry)).join("\n") + "\n", { mode: 0o600 });
const publicEntries = manifest.filter((entry) => entry.visibility === "public");
const privateEntries = manifest.filter((entry) => entry.visibility === "private");
console.log(`manifest: ${manifest.length} objects, ${manifest.reduce((n, entry) => n + entry.size, 0)} bytes`);
console.log(`public: ${publicEntries.length}; private: ${privateEntries.length}`);

if (mode === "--dry-run") process.exit(0);

const client = new S3Client({
  endpoint: cfg.endpoint,
  region: cfg.region,
  forcePathStyle: cfg.forcePathStyle,
  credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
});

let next = 0;
let uploaded = 0;
let skipped = 0;
let uploadedBytes = 0;

async function upload(entry: ManifestEntry) {
  const full = path.join(sourceRoot, ...entry.source.split("/"));
  try {
    const existing = await client.send(new HeadObjectCommand({ Bucket: entry.targetBucket, Key: entry.key }));
    const same = existing.ContentLength === entry.size && existing.Metadata?.sha256 === entry.sha256;
    if (!same) throw new Error(`Existing target differs: ${entry.targetBucket}/${entry.key}`);
    skipped++;
    return;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    const name = (error as { name?: string }).name;
    if (status !== 404 && name !== "NotFound" && name !== "NoSuchKey") throw error;
  }

  await client.send(new PutObjectCommand({
    Bucket: entry.targetBucket,
    Key: entry.key,
    Body: createReadStream(full),
    ContentLength: entry.size,
    ContentType: entry.contentType,
    IfNoneMatch: "*",
    Metadata: { sha256: entry.sha256, sourcebucket: entry.source.split("/", 1)[0] },
  }));
  const head = await client.send(new HeadObjectCommand({ Bucket: entry.targetBucket, Key: entry.key }));
  if (head.ContentLength !== entry.size || head.Metadata?.sha256 !== entry.sha256) {
    throw new Error(`Verification failed: ${entry.targetBucket}/${entry.key}`);
  }
  uploaded++;
  uploadedBytes += entry.size;
  if ((uploaded + skipped) % 20 === 0 || uploaded + skipped === manifest.length) {
    console.log(`verified ${uploaded + skipped}/${manifest.length}; uploaded=${uploaded}; skipped=${skipped}; bytes=${uploadedBytes}`);
  }
}

async function worker() {
  while (true) {
    const index = next++;
    if (index >= manifest.length) return;
    await upload(manifest[index]);
  }
}

await Promise.all(Array.from({ length: 4 }, () => worker()));
await client.destroy();
console.log(`IMPORT COMPLETE: ${manifest.length}/${manifest.length}; uploaded=${uploaded}; skipped=${skipped}; bytes=${uploadedBytes}`);
