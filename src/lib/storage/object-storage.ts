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
