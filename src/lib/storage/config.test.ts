import test from "node:test";
import assert from "node:assert/strict";
import {
  describeStorageConfig,
  getS3Config,
  getStorageBackend,
  isStorageConfigured,
  parseForcePathStyle,
  StorageConfigError,
} from "./config";

const FULL_ENV = {
  S3_ENDPOINT: "https://usc1.contabostorage.com",
  S3_REGION: "usc1",
  S3_ACCESS_KEY: "AKIAEXAMPLEKEYID",
  S3_SECRET_KEY: "example-secret-value-not-real",
  S3_BUCKET_PUBLIC: "hamloprod-public",
  S3_BUCKET_PRIVATE: "hamloprod-private",
  S3_FORCE_PATH_STYLE: "true",
};

test("getS3Config returns a normalised config from a complete env", () => {
  const config = getS3Config({ ...FULL_ENV, S3_ENDPOINT: "https://usc1.contabostorage.com/" });

  assert.equal(config.endpoint, "https://usc1.contabostorage.com");
  assert.equal(config.region, "usc1");
  assert.equal(config.publicBucket, "hamloprod-public");
  assert.equal(config.privateBucket, "hamloprod-private");
  assert.equal(config.forcePathStyle, true);
  assert.equal(config.publicBaseUrl, "https://usc1.contabostorage.com/hamloprod-public");
});

test("getS3Config honours an explicit S3_PUBLIC_BASE_URL", () => {
  const config = getS3Config({ ...FULL_ENV, S3_PUBLIC_BASE_URL: "https://media.hamloprod.org/" });
  assert.equal(config.publicBaseUrl, "https://media.hamloprod.org");
});

test("missing required env throws and names the missing keys only (no values)", () => {
  try {
    getS3Config({ S3_ENDPOINT: "https://usc1.contabostorage.com" });
    assert.fail("expected StorageConfigError");
  } catch (error) {
    assert.ok(error instanceof StorageConfigError);
    assert.match(error.message, /S3_REGION/);
    assert.match(error.message, /S3_ACCESS_KEY/);
    assert.match(error.message, /S3_SECRET_KEY/);
    assert.doesNotMatch(error.message, /example-secret-value-not-real/);
  }
});

test("secret values never appear in the error for a partially filled env", () => {
  try {
    getS3Config({ ...FULL_ENV, S3_BUCKET_PRIVATE: "" });
    assert.fail("expected StorageConfigError");
  } catch (error) {
    assert.ok(error instanceof StorageConfigError);
    assert.doesNotMatch(error.message, /AKIAEXAMPLEKEYID/);
    assert.doesNotMatch(error.message, /example-secret-value-not-real/);
  }
});

test("non-HTTPS endpoint is rejected", () => {
  assert.throws(
    () => getS3Config({ ...FULL_ENV, S3_ENDPOINT: "http://usc1.contabostorage.com" }),
    (error: unknown) => error instanceof StorageConfigError && /HTTPS/.test((error as Error).message),
  );
});

test("non-HTTPS S3_PUBLIC_BASE_URL is rejected", () => {
  assert.throws(
    () => getS3Config({ ...FULL_ENV, S3_PUBLIC_BASE_URL: "http://media.hamloprod.org" }),
    StorageConfigError,
  );
});

test("identical public/private buckets are rejected", () => {
  assert.throws(
    () => getS3Config({ ...FULL_ENV, S3_BUCKET_PRIVATE: "hamloprod-public" }),
    StorageConfigError,
  );
});

test("parseForcePathStyle handles booleans, 1/0 and empty", () => {
  assert.equal(parseForcePathStyle("true"), true);
  assert.equal(parseForcePathStyle("TRUE"), true);
  assert.equal(parseForcePathStyle("1"), true);
  assert.equal(parseForcePathStyle("false"), false);
  assert.equal(parseForcePathStyle("0"), false);
  assert.equal(parseForcePathStyle(""), true);
  assert.equal(parseForcePathStyle(undefined), true);
});

test("parseForcePathStyle rejects garbage", () => {
  assert.throws(() => parseForcePathStyle("maybe"), StorageConfigError);
});

test("isStorageConfigured is false for an empty env and true for a full one", () => {
  assert.equal(isStorageConfigured({}), false);
  assert.equal(isStorageConfigured(FULL_ENV), true);
});

test("getStorageBackend defaults to contabo-s3 and fails closed on a typo", () => {
  assert.equal(getStorageBackend({}), "contabo-s3");
  assert.equal(getStorageBackend({ STORAGE_BACKEND: "" }), "contabo-s3");
  assert.equal(getStorageBackend({ STORAGE_BACKEND: "contabo-s3" }), "contabo-s3");
  assert.equal(getStorageBackend({ STORAGE_BACKEND: "CONTABO-S3" }), "contabo-s3");
  // legacy value still accepted while routes migrate
  assert.equal(getStorageBackend({ STORAGE_BACKEND: "supabase" }), "supabase");
  assert.throws(() => getStorageBackend({ STORAGE_BACKEND: "contabo" }), StorageConfigError);
  assert.throws(() => getStorageBackend({ STORAGE_BACKEND: "s3" }), StorageConfigError);
});

test("describeStorageConfig reports presence booleans and host, never values", () => {
  const described = describeStorageConfig(FULL_ENV);

  assert.equal(described.configured, true);
  assert.equal(described.backend, "contabo-s3");
  assert.equal(described.endpointHost, "usc1.contabostorage.com");
  assert.equal(described.present.S3_ACCESS_KEY, true);
  assert.equal(described.present.S3_PUBLIC_BASE_URL, false);
  assert.doesNotMatch(JSON.stringify(described), /AKIAEXAMPLEKEYID/);
  assert.doesNotMatch(JSON.stringify(described), /example-secret-value-not-real/);
});
