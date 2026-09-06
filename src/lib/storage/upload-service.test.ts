import test from "node:test";
import assert from "node:assert/strict";
import type { ObjectHead } from "./object-storage";
import { createUploadUrl, finalizeUpload, type UploadPort } from "./upload-service";

const BEAT_ID = "11111111-2222-4333-8444-555555555555";
const MB = 1024 * 1024;

function fakePort(overrides: Partial<UploadPort> & { head?: ObjectHead | null } = {}): UploadPort & { uploads: unknown[] } {
  const uploads: unknown[] = [];

  return {
    uploads,
    async createSignedUploadUrl(input) {
      uploads.push(input);
      return {
        url: `https://usc1.contabostorage.com/bucket/${input.key}?X-Amz-Signature=test`,
        method: "PUT",
        headers: { "Content-Type": input.contentType },
        expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
      };
    },
    async headObject() {
      return overrides.head === undefined ? { contentType: "image/png", contentLength: 2 * MB, etag: '"x"' } : overrides.head;
    },
    publicUrlForKey(key) {
      return `https://usc1.contabostorage.com/hamloprod-public/${key}`;
    },
    ...overrides,
  };
}

test("createUploadUrl rejects an unauthenticated caller", async () => {
  const result = await createUploadUrl({ isAuthorized: false, body: {}, storage: fakePort() });
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "Unauthorized");
});

test("createUploadUrl issues a presigned PUT for a valid beat cover request", async () => {
  const storage = fakePort();
  const result = await createUploadUrl({
    isAuthorized: true,
    storage,
    body: { kind: "beat-cover", entityId: BEAT_ID, originalFileName: "cover.png", contentType: "image/png", size: 2 * MB },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.visibility, "public");
  assert.match(String(result.body.key), new RegExp(`^beats/${BEAT_ID}/cover/`));
  assert.ok(String(result.body.publicUrl).endsWith(String(result.body.key)));
  const upload = result.body.upload as { method: string; headers: Record<string, string> };
  assert.equal(upload.method, "PUT");
  assert.equal(upload.headers["Content-Type"], "image/png");
  assert.equal((storage.uploads[0] as { expiresInSeconds: number }).expiresInSeconds, 300);
});

test("createUploadUrl hides the public URL for a private kind", async () => {
  const result = await createUploadUrl({
    isAuthorized: true,
    storage: fakePort(),
    body: { kind: "beat-master", entityId: BEAT_ID, originalFileName: "m.wav", contentType: "audio/wav", size: 100 * MB },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.visibility, "private");
  assert.equal(result.body.publicUrl, null);
});

test("createUploadUrl rejects oversize / wrong-type requests with 422", async () => {
  const tooBig = await createUploadUrl({
    isAuthorized: true,
    storage: fakePort(),
    body: { kind: "beat-cover", entityId: BEAT_ID, originalFileName: "c.png", contentType: "image/png", size: 50 * MB },
  });
  assert.equal(tooBig.status, 422);
  assert.equal(tooBig.body.code, "FILE_TOO_LARGE");

  const wrongType = await createUploadUrl({
    isAuthorized: true,
    storage: fakePort(),
    body: { kind: "beat-preview", entityId: BEAT_ID, originalFileName: "p.mp3", contentType: "video/mp4", size: MB },
  });
  assert.equal(wrongType.status, 422);
});

test("createUploadUrl rejects a non-UUID entity id and unknown kind", async () => {
  const badId = await createUploadUrl({
    isAuthorized: true,
    storage: fakePort(),
    body: { kind: "beat-cover", entityId: "not-uuid", originalFileName: "c.png", contentType: "image/png", size: MB },
  });
  assert.equal(badId.status, 400);

  const badKind = await createUploadUrl({
    isAuthorized: true,
    storage: fakePort(),
    body: { kind: "beat-hologram", entityId: BEAT_ID, originalFileName: "c.png", contentType: "image/png", size: MB },
  });
  assert.equal(badKind.status, 400);
  assert.equal(badKind.body.code, "INVALID_UPLOAD_KIND");
});

test("finalizeUpload rejects an unauthenticated caller", async () => {
  const result = await finalizeUpload({ isAuthorized: false, body: {}, storage: fakePort() });
  assert.equal(result.status, 401);
});

test("finalizeUpload confirms a real object and returns a storage reference", async () => {
  const key = `beats/${BEAT_ID}/cover/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`;
  const result = await finalizeUpload({
    isAuthorized: true,
    storage: fakePort({ head: { contentType: "image/png", contentLength: 2 * MB, etag: '"e"' } }),
    body: { key, kind: "beat-cover" },
  });

  assert.equal(result.status, 200);
  const storage = result.body.storage as Record<string, unknown>;
  assert.equal(storage.key, key);
  assert.equal(storage.visibility, "public");
  assert.equal(storage.size, 2 * MB);
  assert.equal(storage.publicUrl, `https://usc1.contabostorage.com/hamloprod-public/${key}`);
});

test("finalizeUpload rejects a key that does not match the declared kind", async () => {
  const masterKey = `beats/${BEAT_ID}/master/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.wav`;

  // Caller tries to finalize a private master under the permissive public cover rule.
  const result = await finalizeUpload({
    isAuthorized: true,
    storage: fakePort({ head: { contentType: "image/png", contentLength: 1 * MB, etag: null } }),
    body: { key: masterKey, kind: "beat-cover" },
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.code, "KEY_KIND_MISMATCH");
});

test("finalizeUpload rejects a traversal key", async () => {
  const result = await finalizeUpload({
    isAuthorized: true,
    storage: fakePort(),
    body: { key: "../../hamloprod-private/beats/x/master/y.wav", kind: "beat-master" },
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.code, "UNSAFE_OBJECT_KEY");
});

test("finalizeUpload returns 404 when the object is missing", async () => {
  const key = `beats/${BEAT_ID}/master/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.wav`;
  const result = await finalizeUpload({
    isAuthorized: true,
    storage: fakePort({ head: null }),
    body: { key, kind: "beat-master" },
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.code, "OBJECT_NOT_FOUND");
});

test("finalizeUpload rejects a stored object whose real type is wrong (422)", async () => {
  const key = `beats/${BEAT_ID}/preview/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.mp3`;
  const result = await finalizeUpload({
    isAuthorized: true,
    storage: fakePort({ head: { contentType: "application/octet-stream", contentLength: MB, etag: null } }),
    body: { key, kind: "beat-preview" },
  });

  assert.equal(result.status, 422);
  assert.equal(result.body.code, "INVALID_CONTENT_TYPE");
});
