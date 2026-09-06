import test from "node:test";
import assert from "node:assert/strict";
import {
  bucketForVisibility,
  getUploadRule,
  UnknownUploadKindError,
  UPLOAD_RULES,
  validateFinalizedObject,
  validateUploadRequest,
  visibilityForKind,
} from "./upload-rules";

const MB = 1024 * 1024;
const GB = 1024 * MB;
const BUCKETS = { publicBucket: "hamloprod-public", privateBucket: "hamloprod-private" };

test("the four beat rules match the spec", () => {
  assert.deepEqual(
    { v: UPLOAD_RULES["beat-cover"].visibility, max: UPLOAD_RULES["beat-cover"].maxBytes, mime: UPLOAD_RULES["beat-cover"].mimeTypes },
    { v: "public", max: 10 * MB, mime: ["image/jpeg", "image/png", "image/webp"] },
  );

  assert.equal(UPLOAD_RULES["beat-preview"].visibility, "public");
  assert.equal(UPLOAD_RULES["beat-preview"].maxBytes, 30 * MB);
  assert.deepEqual(UPLOAD_RULES["beat-preview"].mimeTypes, ["audio/mpeg"]);

  assert.equal(UPLOAD_RULES["beat-master"].visibility, "private");
  assert.equal(UPLOAD_RULES["beat-master"].maxBytes, 500 * MB);
  assert.ok(UPLOAD_RULES["beat-master"].mimeTypes.includes("audio/wav"));

  assert.equal(UPLOAD_RULES["beat-archive"].visibility, "private");
  assert.equal(UPLOAD_RULES["beat-archive"].maxBytes, 2 * GB);
  assert.ok(UPLOAD_RULES["beat-archive"].mimeTypes.includes("application/zip"));
});

test("bucketForVisibility selects purely by visibility", () => {
  assert.equal(bucketForVisibility("public", BUCKETS), "hamloprod-public");
  assert.equal(bucketForVisibility("private", BUCKETS), "hamloprod-private");
  assert.equal(bucketForVisibility(visibilityForKind("beat-cover"), BUCKETS), "hamloprod-public");
  assert.equal(bucketForVisibility(visibilityForKind("beat-master"), BUCKETS), "hamloprod-private");
  assert.equal(bucketForVisibility(visibilityForKind("beat-archive"), BUCKETS), "hamloprod-private");
});

test("getUploadRule throws for an unknown kind", () => {
  // @ts-expect-error deliberate bad kind
  assert.throws(() => getUploadRule("beat-thumbnail"), UnknownUploadKindError);
});

test("validateUploadRequest accepts a well-formed request", () => {
  const result = validateUploadRequest({
    kind: "beat-cover",
    contentType: "image/png",
    originalFileName: "Cover Art.PNG",
    size: 2 * MB,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.extension, "png");
    assert.equal(result.rule.visibility, "public");
  }
});

test("validateUploadRequest rejects a disallowed MIME type", () => {
  const result = validateUploadRequest({
    kind: "beat-preview",
    contentType: "audio/wav",
    originalFileName: "preview.wav",
    size: MB,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_CONTENT_TYPE");
  }
});

test("validateUploadRequest rejects a disallowed extension", () => {
  const result = validateUploadRequest({
    kind: "beat-master",
    contentType: "audio/wav",
    originalFileName: "master.mp3",
    size: MB,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_EXTENSION");
  }
});

test("validateUploadRequest rejects a MIME/extension mismatch", () => {
  const result = validateUploadRequest({
    kind: "beat-cover",
    contentType: "image/png",
    originalFileName: "cover.webp",
    size: MB,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "EXTENSION_MIME_MISMATCH");
  }
});

test("validateUploadRequest rejects zero and oversized files", () => {
  const zero = validateUploadRequest({ kind: "beat-cover", contentType: "image/png", originalFileName: "c.png", size: 0 });
  assert.equal(zero.ok, false);
  if (!zero.ok) assert.equal(zero.code, "INVALID_SIZE");

  const huge = validateUploadRequest({ kind: "beat-cover", contentType: "image/png", originalFileName: "c.png", size: 11 * MB });
  assert.equal(huge.ok, false);
  if (!huge.ok) assert.equal(huge.code, "FILE_TOO_LARGE");

  const wavOk = validateUploadRequest({ kind: "beat-master", contentType: "audio/wav", originalFileName: "m.wav", size: 480 * MB });
  assert.equal(wavOk.ok, true);

  const wavHuge = validateUploadRequest({ kind: "beat-master", contentType: "audio/wav", originalFileName: "m.wav", size: 501 * MB });
  assert.equal(wavHuge.ok, false);
});

test("validateFinalizedObject checks the real stored metadata", () => {
  assert.equal(
    validateFinalizedObject({ kind: "beat-preview", contentType: "audio/mpeg", contentLength: 5 * MB }).ok,
    true,
  );

  const badType = validateFinalizedObject({ kind: "beat-preview", contentType: "application/octet-stream", contentLength: 5 * MB });
  assert.equal(badType.ok, false);
  if (!badType.ok) assert.equal(badType.code, "INVALID_CONTENT_TYPE");

  const noSize = validateFinalizedObject({ kind: "beat-preview", contentType: "audio/mpeg", contentLength: null });
  assert.equal(noSize.ok, false);

  const tooBig = validateFinalizedObject({ kind: "beat-cover", contentType: "image/png", contentLength: 20 * MB });
  assert.equal(tooBig.ok, false);
  if (!tooBig.ok) assert.equal(tooBig.code, "FILE_TOO_LARGE");
});
