/** Server-side boundary. Bucket credentials are never exposed to the browser.
 * The service validates authorization, entity ownership, MIME, extension and size
 * before upload/signing. Keys are server-generated, not client filenames or URLs.
 */
export type StorageVisibility = "public" | "private";
export type StoredObject = { visibility: StorageVisibility; key: string };
export type PublicObject = StoredObject & { visibility: "public" };
export type PutObjectInput = StoredObject & {
  body: Uint8Array | ReadableStream<Uint8Array>;
  contentType: string;
  contentLength: number;
};
export type SignedDownload = { url: string; expiresAt: string };

export interface ObjectStorage {
  /** Create only; collisions reject. Replace by new key, DB swap, then old-key cleanup. */
  putObject(input: PutObjectInput): Promise<StoredObject>;
  /** Idempotent, including when the object no longer exists. */
  deleteObject(object: StoredObject): Promise<void>;
  /** Adapters must also reject private objects at runtime. */
  getPublicUrl(object: PublicObject): string;
  /** Service checks paid order/other entitlement first. Enforce 300–900 seconds. */
  createSignedDownloadUrl(object: StoredObject, options: { expiresInSeconds: number; downloadName?: string }): Promise<SignedDownload>;
}

/** Metadata read back from the store after a direct browser upload. */
export type ObjectHead = { contentType: string | null; contentLength: number | null; etag: string | null };

export type SignedUpload = {
  url: string;
  method: "PUT";
  /** Headers the browser MUST send with the PUT so the signature matches. */
  headers: Record<string, string>;
  expiresAt: string;
};

/**
 * Direct-to-storage upload capability. Large private assets (WAV, ZIP) must not be
 * proxied through a Route Handler, so the browser receives a short-lived presigned
 * PUT for one server-generated key. Credentials never leave the server.
 */
export interface DirectUploadStorage extends ObjectStorage {
  /** TTL is clamped to a short window (≤ 600s). One key, one visibility, one content type. */
  createSignedUploadUrl(input: StoredObject & { contentType: string; expiresInSeconds: number }): Promise<SignedUpload>;
  /** Returns null when the object does not exist. Used by finalize to verify a completed upload. */
  headObject(object: StoredObject): Promise<ObjectHead | null>;
}
