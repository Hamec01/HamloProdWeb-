import test from "node:test";
import assert from "node:assert/strict";
import type { S3Client } from "@aws-sdk/client-s3";
import type { S3Config } from "./config";
import {
  ContaboS3Storage,
  ObjectAlreadyExistsError,
  PrivateObjectAccessError,
  SignedUrlExpiryError,
} from "./contabo-s3-storage";
import type { PublicObject } from "./object-storage";

const CONFIG: S3Config = {
  endpoint: "https://usc1.contabostorage.com",
  region: "usc1",
  accessKeyId: "AKIAEXAMPLEKEYID",
  secretAccessKey: "example-secret-not-real",
  publicBucket: "hamloprod-public",
  privateBucket: "hamloprod-private",
  forcePathStyle: true,
  publicBaseUrl: "https://usc1.contabostorage.com/hamloprod-public",
};

const PUBLIC_KEY = "beats/11111111-2222-4333-8444-555555555555/cover/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png";
const PRIVATE_KEY = "beats/11111111-2222-4333-8444-555555555555/master/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.wav";

type Call = { type: string; input: Record<string, unknown> };

function notFound(): Error {
  const error = new Error("not found") as Error & { name: string; $metadata: { httpStatusCode: number } };
  error.name = "NotFound";
  error.$metadata = { httpStatusCode: 404 };
  return error;
}

function fakeClient(handlers: {
  head?: (input: Record<string, unknown>) => unknown;
  put?: (input: Record<string, unknown>) => unknown;
  del?: (input: Record<string, unknown>) => unknown;
}) {
  const calls: Call[] = [];

  const client = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const type = command.constructor.name;
      calls.push({ type, input: command.input });

      if (type === "HeadObjectCommand") {
        return (handlers.head ?? (() => { throw notFound(); }))(command.input);
      }
      if (type === "PutObjectCommand") {
        return (handlers.put ?? (() => ({})))(command.input);
      }
      if (type === "DeleteObjectCommand") {
        return (handlers.del ?? (() => ({})))(command.input);
      }

      throw new Error(`unexpected command: ${type}`);
    },
  };

  return { client: client as unknown as S3Client, calls };
}

test("getPublicUrl builds a path-style URL for a public object", () => {
  const storage = new ContaboS3Storage(CONFIG, fakeClient({}));
  assert.equal(
    storage.getPublicUrl({ visibility: "public", key: PUBLIC_KEY }),
    `https://usc1.contabostorage.com/hamloprod-public/${PUBLIC_KEY}`,
  );
});

test("getPublicUrl refuses a private object", () => {
  const storage = new ContaboS3Storage(CONFIG, fakeClient({}));
  assert.throws(
    () => storage.getPublicUrl({ visibility: "private", key: PRIVATE_KEY } as unknown as PublicObject),
    PrivateObjectAccessError,
  );
});

test("putObject writes to the public bucket for a public object", async () => {
  const { client, calls } = fakeClient({});
  const storage = new ContaboS3Storage(CONFIG, { client });

  const result = await storage.putObject({
    visibility: "public",
    key: PUBLIC_KEY,
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    contentLength: 3,
  });

  assert.deepEqual(result, { visibility: "public", key: PUBLIC_KEY });
  assert.deepEqual(calls.map((call) => call.type), ["HeadObjectCommand", "PutObjectCommand"]);
  assert.equal(calls[0].input.Bucket, "hamloprod-public");
  assert.equal(calls[1].input.Bucket, "hamloprod-public");
  assert.equal(calls[1].input.Key, PUBLIC_KEY);
});

test("putObject writes to the private bucket for a private object", async () => {
  const { client, calls } = fakeClient({});
  const storage = new ContaboS3Storage(CONFIG, { client });

  await storage.putObject({
    visibility: "private",
    key: PRIVATE_KEY,
    body: new Uint8Array([1]),
    contentType: "audio/wav",
    contentLength: 1,
  });

  assert.equal(calls.at(-1)?.input.Bucket, "hamloprod-private");
});

test("putObject is create-only: an existing key rejects without a PUT", async () => {
  const { client, calls } = fakeClient({ head: () => ({ ContentLength: 10 }) });
  const storage = new ContaboS3Storage(CONFIG, { client });

  await assert.rejects(
    storage.putObject({
      visibility: "public",
      key: PUBLIC_KEY,
      body: new Uint8Array([1]),
      contentType: "image/png",
      contentLength: 1,
    }),
    ObjectAlreadyExistsError,
  );

  assert.deepEqual(calls.map((call) => call.type), ["HeadObjectCommand"]);
});

test("putObject rejects a traversal key before any network call", async () => {
  const { client, calls } = fakeClient({});
  const storage = new ContaboS3Storage(CONFIG, { client });

  await assert.rejects(
    storage.putObject({
      visibility: "private",
      key: "../../etc/passwd",
      body: new Uint8Array([1]),
      contentType: "audio/wav",
      contentLength: 1,
    }),
    /Unsafe object key/,
  );
  assert.equal(calls.length, 0);
});

test("deleteObject picks the bucket by visibility and is idempotent on 404", async () => {
  const seen: Call[] = [];
  const { client } = fakeClient({
    del: (input) => {
      seen.push({ type: "DeleteObjectCommand", input });
      throw notFound();
    },
  });
  const storage = new ContaboS3Storage(CONFIG, { client });

  await assert.doesNotReject(storage.deleteObject({ visibility: "private", key: PRIVATE_KEY }));
  assert.equal(seen[0]?.input.Bucket, "hamloprod-private");
});

test("deleteObject rejects a traversal key", async () => {
  const storage = new ContaboS3Storage(CONFIG, fakeClient({}));
  await assert.rejects(storage.deleteObject({ visibility: "public", key: "/leading/slash.png" }), /Unsafe object key/);
});

test("headObject maps metadata and returns null on 404", async () => {
  const present = new ContaboS3Storage(CONFIG, {
    client: fakeClient({ head: () => ({ ContentType: "audio/wav", ContentLength: 4242, ETag: '"abc"' }) }).client,
  });
  assert.deepEqual(await present.headObject({ visibility: "private", key: PRIVATE_KEY }), {
    contentType: "audio/wav",
    contentLength: 4242,
    etag: '"abc"',
  });

  const absent = new ContaboS3Storage(CONFIG, fakeClient({}));
  assert.equal(await absent.headObject({ visibility: "private", key: PRIVATE_KEY }), null);
});

test("createSignedDownloadUrl enforces a 5–15 minute TTL", async () => {
  const storage = new ContaboS3Storage(CONFIG);

  await assert.rejects(storage.createSignedDownloadUrl({ visibility: "private", key: PRIVATE_KEY }, { expiresInSeconds: 200 }), SignedUrlExpiryError);
  await assert.rejects(storage.createSignedDownloadUrl({ visibility: "private", key: PRIVATE_KEY }, { expiresInSeconds: 1000 }), SignedUrlExpiryError);

  const signed = await storage.createSignedDownloadUrl({ visibility: "private", key: PRIVATE_KEY }, { expiresInSeconds: 600 });
  assert.match(signed.url, /^https:\/\/usc1\.contabostorage\.com\/hamloprod-private\//);
  assert.ok(signed.url.includes("master"));
  assert.match(signed.url, /X-Amz-Expires=600/);

  const deltaMs = new Date(signed.expiresAt).getTime() - Date.now();
  assert.ok(deltaMs > 590_000 && deltaMs <= 600_000, `expiresAt delta ${deltaMs}`);
});

test("createSignedUploadUrl returns a presigned PUT with a short TTL", async () => {
  const storage = new ContaboS3Storage(CONFIG);

  await assert.rejects(
    storage.createSignedUploadUrl({ visibility: "private", key: PRIVATE_KEY, contentType: "audio/wav", expiresInSeconds: 30 }),
    SignedUrlExpiryError,
  );
  await assert.rejects(
    storage.createSignedUploadUrl({ visibility: "private", key: PRIVATE_KEY, contentType: "audio/wav", expiresInSeconds: 3600 }),
    SignedUrlExpiryError,
  );

  const signed = await storage.createSignedUploadUrl({
    visibility: "private",
    key: PRIVATE_KEY,
    contentType: "audio/wav",
    expiresInSeconds: 300,
  });

  assert.equal(signed.method, "PUT");
  assert.deepEqual(signed.headers, { "Content-Type": "audio/wav", "If-None-Match": "*" });
  assert.match(decodeURIComponent(signed.url), /X-Amz-SignedHeaders=[^&]*if-none-match/);
  assert.match(signed.url, /^https:\/\/usc1\.contabostorage\.com\/hamloprod-private\//);
  assert.match(signed.url, /X-Amz-Expires=300/);
});
