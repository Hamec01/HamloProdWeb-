/**
 * Apply the bucket policy + CORS for hamloprod-public / hamloprod-private on
 * Contabo. Idempotent. Reads S3_* from the environment (.env / .env.local).
 *
 *   npx tsx scripts/storage-provision.mts          # apply
 *   npx tsx scripts/storage-provision.mts --check  # report current state only
 *
 * If the S3 credentials are object-scoped (no bucket-admin rights) the Put*
 * calls return AccessDenied — the script reports that and the exact JSON to
 * paste into the Contabo customer panel. It never prints keys / secrets / URLs.
 */

import { getS3Config } from "@/lib/storage/config";
import {
  applyBucketCors,
  applyBucketPolicy,
  buildCorsRules,
  buildPublicReadPolicy,
  corsOriginsFromEnv,
  makeAdminClient,
  readBucketCors,
  readBucketPolicy,
} from "@/lib/storage/bucket-admin";

const checkOnly = process.argv.includes("--check");
const cfg = getS3Config();
const client = makeAdminClient(cfg);
const corsOrigins = corsOriginsFromEnv();

function line(label: string, value: string) {
  console.log(`  ${label.padEnd(26)} ${value}`);
}

async function reportBucket(bucket: string) {
  console.log(`\n[${bucket}]`);
  const pol = await readBucketPolicy(client, bucket);
  line("policy (read)", pol.ok ? (pol.value ? "present" : "none") : `${pol.code}${pol.status ? ` ${pol.status}` : ""}`);
  const cors = await readBucketCors(client, bucket);
  line("cors (read)", cors.ok ? (cors.value ? `${cors.value.length} rule(s)` : "none") : `${cors.code}${cors.status ? ` ${cors.status}` : ""}`);
}

async function apply(bucket: string, opts: { policy: boolean }) {
  console.log(`\n[${bucket}] applying …`);
  if (opts.policy) {
    const res = await applyBucketPolicy(client, bucket, buildPublicReadPolicy(bucket));
    line("PutBucketPolicy", res.ok ? "OK" : `FAIL ${res.code}${res.status ? ` ${res.status}` : ""}`);
  }
  const corsRes = await applyBucketCors(client, bucket, buildCorsRules(corsOrigins));
  line("PutBucketCors", corsRes.ok ? "OK" : `FAIL ${corsRes.code}${corsRes.status ? ` ${corsRes.status}` : ""}`);
}

console.log(`endpoint host: ${new URL(cfg.endpoint).host}  path-style: ${cfg.forcePathStyle}`);
console.log(`public bucket: ${cfg.publicBucket}   private bucket: ${cfg.privateBucket}`);
console.log(`cors origins:  ${corsOrigins.join(", ")}`);

await reportBucket(cfg.publicBucket);
await reportBucket(cfg.privateBucket);

if (!checkOnly) {
  // public: anonymous GetObject + CORS.  private: CORS only (no public policy).
  await apply(cfg.publicBucket, { policy: true });
  await apply(cfg.privateBucket, { policy: false });
  console.log("\n--- state after apply ---");
  await reportBucket(cfg.publicBucket);
  await reportBucket(cfg.privateBucket);
}

console.log("\nIf Put*/Get* returned AccessDenied the S3 key is object-scoped. Set this in the");
console.log("Contabo customer panel (Object Storage → bucket → Permissions / CORS):");
console.log(`\n  ${cfg.publicBucket} bucket policy:\n${buildPublicReadPolicy(cfg.publicBucket).split("\n").map((l) => "    " + l).join("\n")}`);
console.log(`\n  CORS (both buckets) — set AUTH_EXTRA_ORIGINS to add the Vercel Preview URL:\n${JSON.stringify(buildCorsRules(corsOrigins), null, 2).split("\n").map((l) => "    " + l).join("\n")}`);
