/**
 * Server-only database configuration checks.
 *
 * `DATABASE_URL` is the runtime connection (least-privilege app role).
 * `DIRECT_URL` is migrations only and must never be read by application code.
 */

export type EnvSource = Record<string, string | undefined>;

export class DatabaseConfigError extends Error {
  readonly code = "DATABASE_CONFIG_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

/** Validate a PostgreSQL connection string without exposing its contents. */
export function assertPostgresUrl(raw: string | undefined, name = "DATABASE_URL"): string {
  const value = (raw ?? "").trim();

  if (value === "") {
    throw new DatabaseConfigError(`${name} is not set.`);
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new DatabaseConfigError(`${name} is not a valid connection URL.`);
  }

  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new DatabaseConfigError(`${name} must be a postgresql:// URL.`);
  }

  if (!parsed.hostname) {
    throw new DatabaseConfigError(`${name} is missing a host.`);
  }

  return value;
}

export function isDatabaseConfigured(env: EnvSource = process.env): boolean {
  try {
    assertPostgresUrl(env.DATABASE_URL);
    return true;
  } catch {
    return false;
  }
}

export type DataBackend = "postgres" | "supabase";

/**
 * Active data backend. PostgreSQL is the target: unset (or `postgres`) resolves
 * to `postgres`. The legacy `supabase` value is still recognised while entities
 * are migrated, but Supabase is never used as a fallback and any other value
 * fails closed. The error never contains `DATABASE_URL`.
 */
export function getDataBackend(env: EnvSource = process.env): DataBackend {
  const value = (env.DATA_BACKEND ?? "").trim().toLowerCase();

  if (value === "" || value === "postgres") {
    return "postgres";
  }

  if (value === "supabase") {
    return "supabase";
  }

  throw new DatabaseConfigError('DATA_BACKEND must be "postgres" (default) or the legacy "supabase".');
}

/** Non-secret snapshot for docs / health checks — host and database name only. */
export function describeDatabaseConfig(env: EnvSource = process.env): {
  configured: boolean;
  host: string | null;
  database: string | null;
  hasDirectUrl: boolean;
} {
  let host: string | null = null;
  let database: string | null = null;

  try {
    const parsed = new URL((env.DATABASE_URL ?? "").trim());
    host = parsed.hostname || null;
    database = parsed.pathname.replace(/^\//, "") || null;
  } catch {
    host = null;
  }

  return {
    configured: isDatabaseConfigured(env),
    host,
    database,
    hasDirectUrl: Boolean((env.DIRECT_URL ?? "").trim()),
  };
}
