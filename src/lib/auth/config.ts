/**
 * Server-only auth configuration. Errors never contain the secret value.
 */

export type EnvSource = Record<string, string | undefined>;

/** Minimum entropy for SESSION_SECRET: 32 bytes. */
const MIN_SECRET_BYTES = 32;

export class AuthConfigError extends Error {
  readonly code = "AUTH_CONFIG_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

function decodedByteLength(value: string): number {
  // Accept hex, base64 / base64url, or raw text — whichever yields the most bytes.
  const candidates = [Buffer.byteLength(value, "utf8")];

  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
    candidates.push(value.length / 2);
  }

  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    try {
      candidates.push(Buffer.from(value, "base64").length);
    } catch {
      // ignore
    }
  }

  return Math.max(...candidates);
}

/**
 * The HMAC key for session-token hashing. Throws {@link AuthConfigError} naming
 * only the variable, never its value.
 */
export function getSessionSecret(env: EnvSource = process.env): string {
  const value = (env.SESSION_SECRET ?? "").trim();

  if (value === "") {
    throw new AuthConfigError("SESSION_SECRET is not set.");
  }

  if (decodedByteLength(value) < MIN_SECRET_BYTES) {
    throw new AuthConfigError(`SESSION_SECRET must carry at least ${MIN_SECRET_BYTES} bytes of entropy.`);
  }

  return value;
}

export function isAuthConfigured(env: EnvSource = process.env): boolean {
  try {
    getSessionSecret(env);
    return true;
  } catch {
    return false;
  }
}
