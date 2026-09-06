/**
 * Transport-agnostic logic for the direct-to-S3 upload flow.
 *
 * No `next/*` imports so it can be unit-tested directly. The Route Handlers in
 * `src/app/api/admin/storage/*` do only: env guard, admin/editor session check,
 * body parsing, then delegate here with an injected storage port.
 *
 * Trust boundary: the client supplies `kind`, `entityId`, `originalFileName`,
 * `contentType` and `size` for `upload-url`, and only `key` + `kind` for
 * `finalize`. The bucket and visibility are always derived server-side from the
 * kind; a client-provided bucket, key/kind mismatch or public URL is rejected.
 */

import { z } from "zod";
import type { ObjectHead, SignedUpload, StorageVisibility, StoredObject } from "./object-storage";
import { assertSafeObjectKey, generateObjectKey, isUploadKind, keyMatchesKind, UnsafeObjectKeyError } from "./keys";
import { getUploadRule, validateFinalizedObject, validateUploadRequest, visibilityForKind } from "./upload-rules";

/** Minimal storage surface the handlers need. `ContaboS3Storage` satisfies it. */
export type UploadPort = {
  createSignedUploadUrl(
    input: StoredObject & { contentType: string; expiresInSeconds: number },
  ): Promise<SignedUpload>;
  headObject(object: StoredObject): Promise<ObjectHead | null>;
  publicUrlForKey(key: string): string;
};

export type HandlerResult = { status: number; body: Record<string, unknown> };

export const DEFAULT_UPLOAD_URL_TTL_SECONDS = 300;

const uploadUrlSchema = z.object({
  kind: z.string().min(1),
  entityId: z.string().uuid(),
  originalFileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
});

const finalizeSchema = z.object({
  key: z.string().min(1).max(1024),
  kind: z.string().min(1),
});

function unauthorized(): HandlerResult {
  return { status: 401, body: { error: "Unauthorized" } };
}

function badRequest(message: string, code?: string): HandlerResult {
  return { status: 400, body: code ? { error: message, code } : { error: message } };
}

export async function createUploadUrl(params: {
  isAuthorized: boolean;
  body: unknown;
  storage: UploadPort;
  ttlSeconds?: number;
}): Promise<HandlerResult> {
  if (!params.isAuthorized) {
    return unauthorized();
  }

  const parsed = uploadUrlSchema.safeParse(params.body);

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  const { kind, entityId, originalFileName, contentType, size } = parsed.data;

  if (!isUploadKind(kind)) {
    return badRequest(`Unknown upload kind: ${kind}`, "INVALID_UPLOAD_KIND");
  }

  const validation = validateUploadRequest({ kind, contentType, originalFileName, size });

  if (!validation.ok) {
    return { status: 422, body: { error: validation.message, code: validation.code } };
  }

  let key: string;

  try {
    key = generateObjectKey({ kind, entityId, originalFileName }).key;
  } catch (error) {
    if (error instanceof UnsafeObjectKeyError) {
      return badRequest(error.message, error.code);
    }

    return badRequest("Could not generate a storage key for this request.");
  }

  const visibility: StorageVisibility = validation.rule.visibility;
  const ttlSeconds = params.ttlSeconds ?? DEFAULT_UPLOAD_URL_TTL_SECONDS;

  const signed = await params.storage.createSignedUploadUrl({
    visibility,
    key,
    contentType: validation.contentType,
    expiresInSeconds: ttlSeconds,
  });

  return {
    status: 200,
    body: {
      key,
      kind,
      visibility,
      maxBytes: validation.rule.maxBytes,
      upload: { url: signed.url, method: signed.method, headers: signed.headers },
      expiresAt: signed.expiresAt,
      publicUrl: visibility === "public" ? params.storage.publicUrlForKey(key) : null,
    },
  };
}

export async function finalizeUpload(params: {
  isAuthorized: boolean;
  body: unknown;
  storage: UploadPort;
}): Promise<HandlerResult> {
  if (!params.isAuthorized) {
    return unauthorized();
  }

  const parsed = finalizeSchema.safeParse(params.body);

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  const { key, kind } = parsed.data;

  if (!isUploadKind(kind)) {
    return badRequest(`Unknown upload kind: ${kind}`, "INVALID_UPLOAD_KIND");
  }

  try {
    assertSafeObjectKey(key);
  } catch (error) {
    if (error instanceof UnsafeObjectKeyError) {
      return badRequest(error.message, error.code);
    }

    throw error;
  }

  // Defence-in-depth: the key must structurally belong to the declared kind, so a
  // caller cannot finalize an arbitrary object under a more permissive rule.
  if (!keyMatchesKind(key, kind)) {
    return badRequest("Storage key does not match the declared kind.", "KEY_KIND_MISMATCH");
  }

  const visibility = visibilityForKind(kind);
  const head = await params.storage.headObject({ visibility, key });

  if (!head) {
    return { status: 404, body: { error: "Uploaded object was not found in storage.", code: "OBJECT_NOT_FOUND" } };
  }

  const validation = validateFinalizedObject({
    kind,
    contentType: head.contentType,
    contentLength: head.contentLength,
  });

  if (!validation.ok) {
    return { status: 422, body: { error: validation.message, code: validation.code } };
  }

  const rule = getUploadRule(kind);

  return {
    status: 200,
    body: {
      storage: {
        key,
        kind,
        visibility,
        contentType: head.contentType,
        size: head.contentLength,
        etag: head.etag,
        label: rule.label,
        publicUrl: visibility === "public" ? params.storage.publicUrlForKey(key) : null,
      },
    },
  };
}
