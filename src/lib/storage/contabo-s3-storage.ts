/**
 * Contabo (S3-compatible) implementation of the object-storage boundary.
 *
 * Server-only. The access key / secret key come from {@link S3Config} and never
 * leave this process. Bucket selection is derived purely from `visibility`; a
 * private object can never be turned into a public URL; download URLs live for
 * 5–15 minutes; every key is validated for path traversal before use.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { S3Config } from "./config";
import { assertSafeObjectKey } from "./keys";
import type {
  DirectUploadStorage,
  ObjectHead,
  PublicObject,
  PutObjectInput,
  SignedDownload,
  SignedUpload,
  StorageVisibility,
  StoredObject,
} from "./object-storage";

const MIN_DOWNLOAD_TTL_SECONDS = 300; // 5 minutes
const MAX_DOWNLOAD_TTL_SECONDS = 900; // 15 minutes
const MIN_UPLOAD_TTL_SECONDS = 60;
const MAX_UPLOAD_TTL_SECONDS = 600; // 10 minutes

export class PrivateObjectAccessError extends Error {
  readonly code = "PRIVATE_OBJECT_PUBLIC_URL";

  constructor() {
    super("A private object cannot be exposed through a public URL.");
    this.name = "PrivateObjectAccessError";
  }
}

export class ObjectAlreadyExistsError extends Error {
  readonly code = "OBJECT_ALREADY_EXISTS";

  constructor(key: string) {
    super(`Object already exists: ${key}`);
    this.name = "ObjectAlreadyExistsError";
  }
}

export class SignedUrlExpiryError extends Error {
  readonly code = "INVALID_SIGNED_URL_TTL";

  constructor(message: string) {
    super(message);
    this.name = "SignedUrlExpiryError";
  }
}

export type ContaboS3Deps = {
  /** Inject a stub in tests. Defaults to a real client built from the config. */
  client?: S3Client;
  /** Inject in tests to avoid signing. Defaults to the AWS presigner. */
  getSignedUrl?: typeof getSignedUrl;
};

function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number }; Code?: string };
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.Code === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

function joinUrl(base: string, key: string): string {
  return `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

export class ContaboS3Storage implements DirectUploadStorage {
  private readonly client: S3Client;

  private readonly sign: typeof getSignedUrl;

  constructor(
    private readonly config: S3Config,
    deps: ContaboS3Deps = {},
  ) {
    this.client =
      deps.client ??
      new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
    this.sign = deps.getSignedUrl ?? getSignedUrl;
  }

  private bucketFor(visibility: StorageVisibility): string {
    return visibility === "public" ? this.config.publicBucket : this.config.privateBucket;
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    assertSafeObjectKey(input.key);
    const Bucket = this.bucketFor(input.visibility);

    // Create-only: reject when the key is already taken.
    try {
      await this.client.send(new HeadObjectCommand({ Bucket, Key: input.key }));
      throw new ObjectAlreadyExistsError(input.key);
    } catch (error) {
      if (error instanceof ObjectAlreadyExistsError) {
        throw error;
      }

      if (!isNotFound(error)) {
        throw error;
      }
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      }),
    );

    return { visibility: input.visibility, key: input.key };
  }

  async deleteObject(object: StoredObject): Promise<void> {
    assertSafeObjectKey(object.key);

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucketFor(object.visibility), Key: object.key }),
      );
    } catch (error) {
      if (isNotFound(error)) {
        return;
      }

      throw error;
    }
  }

  getPublicUrl(object: PublicObject): string {
    if (object.visibility !== "public") {
      throw new PrivateObjectAccessError();
    }

    assertSafeObjectKey(object.key);
    return joinUrl(this.config.publicBaseUrl, object.key);
  }

  /** Convenience for callers that only hold a key known to be public. */
  publicUrlForKey(key: string): string {
    return this.getPublicUrl({ visibility: "public", key });
  }

  async createSignedDownloadUrl(
    object: StoredObject,
    options: { expiresInSeconds: number; downloadName?: string },
  ): Promise<SignedDownload> {
    assertSafeObjectKey(object.key);

    const ttl = options.expiresInSeconds;

    if (!Number.isInteger(ttl) || ttl < MIN_DOWNLOAD_TTL_SECONDS || ttl > MAX_DOWNLOAD_TTL_SECONDS) {
      throw new SignedUrlExpiryError(
        `Download URL TTL must be between ${MIN_DOWNLOAD_TTL_SECONDS} and ${MAX_DOWNLOAD_TTL_SECONDS} seconds.`,
      );
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketFor(object.visibility),
      Key: object.key,
      ResponseContentDisposition: options.downloadName
        ? `attachment; filename="${options.downloadName.replace(/["\\\r\n]/g, "")}"`
        : undefined,
    });

    const url = await this.sign(this.client, command, { expiresIn: ttl });
    return { url, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
  }

  async createSignedUploadUrl(
    input: StoredObject & { contentType: string; expiresInSeconds: number },
  ): Promise<SignedUpload> {
    assertSafeObjectKey(input.key);

    const ttl = input.expiresInSeconds;

    if (!Number.isInteger(ttl) || ttl < MIN_UPLOAD_TTL_SECONDS || ttl > MAX_UPLOAD_TTL_SECONDS) {
      throw new SignedUrlExpiryError(
        `Upload URL TTL must be between ${MIN_UPLOAD_TTL_SECONDS} and ${MAX_UPLOAD_TTL_SECONDS} seconds.`,
      );
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketFor(input.visibility),
      Key: input.key,
      ContentType: input.contentType,
    });

    const url = await this.sign(this.client, command, { expiresIn: ttl });

    return {
      url,
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }

  async headObject(object: StoredObject): Promise<ObjectHead | null> {
    assertSafeObjectKey(object.key);

    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketFor(object.visibility), Key: object.key }),
      );

      return {
        contentType: result.ContentType ?? null,
        contentLength: typeof result.ContentLength === "number" ? result.ContentLength : null,
        etag: result.ETag ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }
  }
}
