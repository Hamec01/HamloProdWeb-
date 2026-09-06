import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSafeObjectKey,
  extensionFromFileName,
  generateObjectKey,
  InvalidEntityIdError,
  isUploadKind,
  isUuid,
  keyMatchesKind,
  UnsafeObjectKeyError,
  UPLOAD_KINDS,
} from "./keys";

const BEAT_ID = "11111111-2222-4333-8444-555555555555";
const TRACK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ARTIST_ID = "99999999-8888-4777-8666-555555555555";
const POST_ID = "12345678-1234-4123-8123-123456789abc";

const UUID_SEG = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

test("every kind produces the documented key layout", () => {
  const cases: Array<[Parameters<typeof generateObjectKey>[0], RegExp]> = [
    [{ kind: "beat-cover", entityId: BEAT_ID, originalFileName: "MY COVER.PNG" }, new RegExp(`^beats/${BEAT_ID}/cover/${UUID_SEG}\\.png$`)],
    [{ kind: "beat-preview", entityId: BEAT_ID, originalFileName: "loop.wav" }, new RegExp(`^beats/${BEAT_ID}/preview/${UUID_SEG}\\.mp3$`)],
    [{ kind: "beat-master", entityId: BEAT_ID, originalFileName: "master final.aiff" }, new RegExp(`^beats/${BEAT_ID}/master/${UUID_SEG}\\.wav$`)],
    [{ kind: "beat-archive", entityId: BEAT_ID, originalFileName: "stems.rar" }, new RegExp(`^beats/${BEAT_ID}/archive/${UUID_SEG}\\.zip$`)],
    [{ kind: "track-cover", entityId: TRACK_ID, originalFileName: "art.webp" }, new RegExp(`^tracks/${TRACK_ID}/cover/${UUID_SEG}\\.webp$`)],
    [{ kind: "track-audio", entityId: TRACK_ID, originalFileName: "song.mp3" }, new RegExp(`^tracks/${TRACK_ID}/audio/${UUID_SEG}\\.mp3$`)],
    [{ kind: "artist-avatar", entityId: ARTIST_ID, originalFileName: "face.jpeg" }, new RegExp(`^artists/${ARTIST_ID}/avatar/${UUID_SEG}\\.jpeg$`)],
    [{ kind: "post-file", entityId: POST_ID, originalFileName: "pic.png" }, new RegExp(`^posts/${POST_ID}/${UUID_SEG}\\.png$`)],
  ];

  for (const [input, pattern] of cases) {
    const { key } = generateObjectKey(input);
    assert.match(key, pattern, `${input.kind} -> ${key}`);
  }
});

test("fixed-extension kinds ignore the original file name entirely", () => {
  const { key } = generateObjectKey({ kind: "beat-master", entityId: BEAT_ID, originalFileName: "../../etc/passwd" });
  assert.match(key, new RegExp(`^beats/${BEAT_ID}/master/${UUID_SEG}\\.wav$`));
});

test("keys are unique across calls", () => {
  const keys = new Set(
    Array.from({ length: 50 }, () => generateObjectKey({ kind: "beat-cover", entityId: BEAT_ID, originalFileName: "c.png" }).key),
  );
  assert.equal(keys.size, 50);
});

test("a non-UUID entity id is rejected", () => {
  assert.throws(
    () => generateObjectKey({ kind: "beat-cover", entityId: "not-a-uuid", originalFileName: "c.png" }),
    InvalidEntityIdError,
  );
  assert.throws(
    () => generateObjectKey({ kind: "beat-cover", entityId: "../beats", originalFileName: "c.png" }),
    InvalidEntityIdError,
  );
});

test("a variable-extension kind with no usable extension is rejected", () => {
  assert.throws(
    () => generateObjectKey({ kind: "beat-cover", entityId: BEAT_ID, originalFileName: "noext" }),
    UnsafeObjectKeyError,
  );
});

test("assertSafeObjectKey rejects traversal and unsafe keys", () => {
  const unsafe = [
    "/beats/x/cover/y.png", // leading slash
    "beats/../secrets/x.png", // parent traversal
    "beats/x/../x/y.png", // mid traversal
    "beats//x/y.png", // empty segment
    "beats/x/cover/\u0000.png", // NUL byte (escaped)
    "beats/x/cover/a\tb.png", // TAB
    "beats/x/cover/a b.png", // space
    "beats\\x\\y.png", // backslash
    "..", // bare traversal
    "", // empty
    `beats/${"a".repeat(1100)}.png`, // too long
  ];

  for (const key of unsafe) {
    assert.throws(() => assertSafeObjectKey(key), UnsafeObjectKeyError, JSON.stringify(key));
  }
});

test("assertSafeObjectKey accepts a normal generated key", () => {
  const { key } = generateObjectKey({ kind: "beat-preview", entityId: BEAT_ID, originalFileName: "p.mp3" });
  assert.doesNotThrow(() => assertSafeObjectKey(key));
});

test("keyMatchesKind is strict about prefix, segment and extension", () => {
  const master = generateObjectKey({ kind: "beat-master", entityId: BEAT_ID, originalFileName: "m.wav" }).key;

  assert.equal(keyMatchesKind(master, "beat-master"), true);
  assert.equal(keyMatchesKind(master, "beat-archive"), false);
  assert.equal(keyMatchesKind(master, "beat-cover"), false);
  assert.equal(keyMatchesKind(`beats/${BEAT_ID}/master/not-a-uuid.wav`, "beat-master"), false);
  assert.equal(keyMatchesKind("../beats/x/master/y.wav", "beat-master"), false);
  assert.equal(keyMatchesKind(master.replace(/\.wav$/, ".zip"), "beat-master"), false);
});

test("helpers", () => {
  assert.equal(isUploadKind("beat-cover"), true);
  assert.equal(isUploadKind("beat-thumbnail"), false);
  assert.equal(isUuid(BEAT_ID), true);
  assert.equal(isUuid("nope"), false);
  assert.equal(extensionFromFileName("a.b.PNG"), "png");
  assert.equal(extensionFromFileName("noext"), null);
  assert.equal(extensionFromFileName("trailingdot."), null);
  assert.equal(UPLOAD_KINDS.length, 8);
});
