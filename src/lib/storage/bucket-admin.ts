/**
 * Bucket-level configuration for the Contabo (S3-compatible) storage — policy and
 * CORS. Server-only, admin-time only (used by scripts/storage-provision.mts).
 *
 * The pure builders below are the source of truth for what SHOULD be set; the
 * apply/read helpers are thin SDK wrappers that never throw — they return a
 * result so the provisioning script can report a permission problem clearly
 * instead of crashing.
 */

import {
  GetBucketCorsCommand,
  GetBucketPolicyCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  S3Client,
  type CORSRule,
} from "@aws-sdk/client-s3";
import type { S3Config } from "./config";

export const ALLOWED_BROWSER_ORIGINS = [
  "https://hamloprod.org",
  "https://www.hamloprod.org",
  "http://localhost:3000",
] as const;

/** Anonymous `s3:GetObject` on every object; nothing else (no ListBucket / PUT / DELETE). */
export function buildPublicReadPolicy(bucket: string): string {
  return JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AnonymousGetObject",
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    },
    null,
    2,
  );
}

/** CORS for browser direct uploads / reads. No wildcard origin. */
export function buildCorsRules(origins: readonly string[] = ALLOWED_BROWSER_ORIGINS): CORSRule[] {
  return [
    {
      AllowedOrigins: [...origins],
      AllowedMethods: ["PUT", "GET", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3000,
    },
  ];
}

export function makeAdminClient(config: S3Config): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

export type ApplyResult = { ok: true } | { ok: false; code: string; status?: number };
export type ReadResult<T> = { ok: true; value: T } | { ok: false; code: string; status?: number };

function toFailure(error: unknown): { ok: false; code: string; status?: number } {
  const e = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return { ok: false, code: e?.name || e?.Code || "UnknownError", status: e?.$metadata?.httpStatusCode };
}

export async function applyBucketPolicy(client: S3Client, bucket: string, policy: string): Promise<ApplyResult> {
  try {
    await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }));
    return { ok: true };
  } catch (error) {
    return toFailure(error);
  }
}

export async function applyBucketCors(client: S3Client, bucket: string, rules: CORSRule[]): Promise<ApplyResult> {
  try {
    await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: rules } }));
    return { ok: true };
  } catch (error) {
    return toFailure(error);
  }
}

export async function readBucketPolicy(client: S3Client, bucket: string): Promise<ReadResult<string | null>> {
  try {
    const out = await client.send(new GetBucketPolicyCommand({ Bucket: bucket }));
    return { ok: true, value: out.Policy ?? null };
  } catch (error) {
    const e = error as { name?: string };
    if (e?.name === "NoSuchBucketPolicy") {
      return { ok: true, value: null };
    }
    return toFailure(error);
  }
}

export async function readBucketCors(client: S3Client, bucket: string): Promise<ReadResult<CORSRule[] | null>> {
  try {
    const out = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    return { ok: true, value: out.CORSRules ?? null };
  } catch (error) {
    const e = error as { name?: string };
    if (e?.name === "NoSuchCORSConfiguration") {
      return { ok: true, value: null };
    }
    return toFailure(error);
  }
}
