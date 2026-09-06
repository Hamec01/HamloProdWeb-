/**
 * Server-only configuration for the Contabo (S3-compatible) object storage backend.
 *
 * NEVER import this module from a Client Component. Every value here comes from a
 * non-public environment variable (no `NEXT_PUBLIC_` prefix), so `S3_ACCESS_KEY`
 * and `S3_SECRET_KEY` stay on the server and never reach the client bundle. The
 * config object and its errors are also built so that a secret value is never
 * echoed into an error message or an API response.
 *
 * Contabo is the target object-storage backend. `STORAGE_BACKEND` defaults to
 * `contabo-s3` when unset; the legacy `supabase` value is still accepted while
 * routes are migrated, but an unknown value fails closed.
 */

export type S3Config = {
  /** Normalised: HTTPS only, no trailing slash. */
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBucket: string;
  privateBucket: string;
  forcePathStyle: boolean;
  /** Normalised base for building public object URLs. No trailing slash. */
  publicBaseUrl: string;
};

export type StorageBackend = "supabase" | "contabo-s3";

const REQUIRED_ENV = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET_PUBLIC",
  "S3_BUCKET_PRIVATE",
] as const;

const OPTIONAL_ENV = ["S3_PUBLIC_BASE_URL", "S3_FORCE_PATH_STYLE", "STORAGE_BACKEND"] as const;

export type StorageEnvName = (typeof REQUIRED_ENV)[number] | (typeof OPTIONAL_ENV)[number];

export type EnvSource = Record<string, string | undefined>;

/** Configuration problem that is safe to surface (never contains a secret value). */
export class StorageConfigError extends Error {
  readonly code = "STORAGE_CONFIG_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new StorageConfigError("Storage configuration is server-only and must not run in the browser.");
  }
}

function readValue(env: EnvSource, name: StorageEnvName): string {
  return (env[name] ?? "").trim();
}

/** Accepts true/false/1/0/yes/no/on/off (case-insensitive). Empty ⇒ default true (Contabo needs path-style). */
export function parseForcePathStyle(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();

  if (value === "") {
    return true;
  }

  if (["true", "1", "yes", "on"].includes(value)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(value)) {
    return false;
  }

  throw new StorageConfigError('S3_FORCE_PATH_STYLE must be a boolean ("true" or "false").');
}

/** Trim trailing slashes; keep the scheme + host + any path prefix. */
export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function requireHttpsUrl(raw: string, envName: StorageEnvName): URL {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new StorageConfigError(`${envName} must be a valid absolute URL.`);
  }

  if (parsed.protocol !== "https:") {
    throw new StorageConfigError(`${envName} must use HTTPS.`);
  }

  return parsed;
}

function derivePublicBaseUrl(params: {
  endpoint: string;
  endpointHost: string;
  publicBucket: string;
  forcePathStyle: boolean;
}): string {
  if (params.forcePathStyle) {
    return `${params.endpoint}/${params.publicBucket}`;
  }

  return `https://${params.publicBucket}.${params.endpointHost}`;
}

/**
 * Build the storage config from the environment. Throws {@link StorageConfigError}
 * with a message that lists the offending variable names only — never their values.
 */
export function getS3Config(env: EnvSource = process.env): S3Config {
  assertServerOnly();

  const missing = REQUIRED_ENV.filter((name) => readValue(env, name) === "");

  if (missing.length > 0) {
    throw new StorageConfigError(`Missing required storage environment variables: ${missing.join(", ")}.`);
  }

  const endpointUrl = requireHttpsUrl(readValue(env, "S3_ENDPOINT"), "S3_ENDPOINT");
  const endpoint = normalizeBaseUrl(readValue(env, "S3_ENDPOINT"));
  const forcePathStyle = parseForcePathStyle(env.S3_FORCE_PATH_STYLE);

  const publicBucket = readValue(env, "S3_BUCKET_PUBLIC");
  const privateBucket = readValue(env, "S3_BUCKET_PRIVATE");

  if (publicBucket === privateBucket) {
    throw new StorageConfigError("S3_BUCKET_PUBLIC and S3_BUCKET_PRIVATE must be different buckets.");
  }

  const rawPublicBaseUrl = readValue(env, "S3_PUBLIC_BASE_URL");
  const publicBaseUrl = rawPublicBaseUrl
    ? normalizeBaseUrl(requireHttpsUrl(rawPublicBaseUrl, "S3_PUBLIC_BASE_URL").toString())
    : derivePublicBaseUrl({ endpoint, endpointHost: endpointUrl.host, publicBucket, forcePathStyle });

  return Object.freeze({
    endpoint,
    region: readValue(env, "S3_REGION"),
    accessKeyId: readValue(env, "S3_ACCESS_KEY"),
    secretAccessKey: readValue(env, "S3_SECRET_KEY"),
    publicBucket,
    privateBucket,
    forcePathStyle,
    publicBaseUrl,
  });
}

/** True when a complete, valid storage config is available. Never throws. */
export function isStorageConfigured(env: EnvSource = process.env): boolean {
  try {
    getS3Config(env);
    return true;
  } catch {
    return false;
  }
}

/**
 * Active storage backend. Contabo is the target: an unset (or `contabo-s3`) value
 * resolves to `contabo-s3`. The legacy `supabase` value is still accepted while
 * routes are migrated. Any other value fails closed so a typo never silently
 * points the app at an unconfigured backend.
 */
export function getStorageBackend(env: EnvSource = process.env): StorageBackend {
  const value = (env.STORAGE_BACKEND ?? "").trim().toLowerCase();

  if (value === "" || value === "contabo-s3") {
    return "contabo-s3";
  }

  if (value === "supabase") {
    return "supabase";
  }

  throw new StorageConfigError('STORAGE_BACKEND must be "contabo-s3" (default) or the legacy "supabase".');
}

/**
 * Non-secret status snapshot for docs / health checks. Reports which variables are
 * present (boolean only) and the endpoint host — never a key or secret value.
 */
export function describeStorageConfig(env: EnvSource = process.env): {
  backend: StorageBackend | "invalid";
  configured: boolean;
  present: Record<StorageEnvName, boolean>;
  endpointHost: string | null;
  forcePathStyle: boolean | null;
} {
  const present = Object.fromEntries(
    [...REQUIRED_ENV, ...OPTIONAL_ENV].map((name) => [name, readValue(env, name) !== ""]),
  ) as Record<StorageEnvName, boolean>;

  let backend: StorageBackend | "invalid";
  try {
    backend = getStorageBackend(env);
  } catch {
    backend = "invalid";
  }

  let endpointHost: string | null = null;
  let forcePathStyle: boolean | null = null;
  try {
    endpointHost = new URL(readValue(env, "S3_ENDPOINT")).host;
  } catch {
    endpointHost = null;
  }
  try {
    forcePathStyle = parseForcePathStyle(env.S3_FORCE_PATH_STYLE);
  } catch {
    forcePathStyle = null;
  }

  return {
    backend,
    configured: isStorageConfigured(env),
    present,
    endpointHost,
    forcePathStyle,
  };
}
