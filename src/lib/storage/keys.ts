/**
 * Safe object-key generation and validation.
 *
 * A user-supplied file name is NEVER used as (or inside) a storage path. Keys are
 * built from the entity UUID plus a fresh `crypto.randomUUID()`:
 *
 *   beats/<beat-id>/cover/<uuid>.<ext>
 *   beats/<beat-id>/preview/<uuid>.mp3
 *   beats/<beat-id>/master/<uuid>.wav
 *   beats/<beat-id>/archive/<uuid>.zip
 *   tracks/<track-id>/cover/<uuid>.<ext>
 *   tracks/<track-id>/audio/<uuid>.mp3
 *   artists/<artist-id>/avatar/<uuid>.<ext>
 *   posts/<post-id>/<uuid>.<ext>
 */

export type UploadKind =
  | "beat-cover"
  | "beat-preview"
  | "beat-master"
  | "beat-archive"
  | "track-cover"
  | "track-audio"
  | "artist-avatar"
  | "post-file";

type KeyLayout = {
  prefix: "beats" | "tracks" | "artists" | "posts";
  segment: string | null;
  /** When set, the extension is forced regardless of the original file name. */
  fixedExt: string | null;
};

const KEY_LAYOUT: Record<UploadKind, KeyLayout> = {
  "beat-cover": { prefix: "beats", segment: "cover", fixedExt: null },
  "beat-preview": { prefix: "beats", segment: "preview", fixedExt: "mp3" },
  "beat-master": { prefix: "beats", segment: "master", fixedExt: "wav" },
  "beat-archive": { prefix: "beats", segment: "archive", fixedExt: "zip" },
  "track-cover": { prefix: "tracks", segment: "cover", fixedExt: null },
  "track-audio": { prefix: "tracks", segment: "audio", fixedExt: "mp3" },
  "artist-avatar": { prefix: "artists", segment: "avatar", fixedExt: null },
  "post-file": { prefix: "posts", segment: null, fixedExt: null },
};

export const UPLOAD_KINDS = Object.keys(KEY_LAYOUT) as UploadKind[];

const UUID_SOURCE = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const UUID_RE = new RegExp(`^${UUID_SOURCE}$`);
/** S3-safe key: printable ASCII subset, no leading separator, no dodgy characters. */
const SAFE_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9!_.*'()/-]*$/;
const EXT_RE = /^[a-z0-9]{1,8}$/;
const MAX_KEY_LENGTH = 1024;

export class UnsafeObjectKeyError extends Error {
  readonly code = "UNSAFE_OBJECT_KEY";

  constructor(reason: string) {
    super(`Unsafe object key: ${reason}`);
    this.name = "UnsafeObjectKeyError";
  }
}

export class InvalidUploadKindError extends Error {
  readonly code = "INVALID_UPLOAD_KIND";

  constructor(kind: string) {
    super(`Unknown upload kind: ${JSON.stringify(kind)}`);
    this.name = "InvalidUploadKindError";
  }
}

export class InvalidEntityIdError extends Error {
  readonly code = "INVALID_ENTITY_ID";

  constructor() {
    super("entityId must be a UUID.");
    this.name = "InvalidEntityIdError";
  }
}

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(KEY_LAYOUT, value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Lower-cased extension without the dot, or null when the name has no usable extension. */
export function extensionFromFileName(fileName: string): string | null {
  const dot = fileName.lastIndexOf(".");

  if (dot < 0 || dot === fileName.length - 1) {
    return null;
  }

  const ext = fileName.slice(dot + 1).toLowerCase();
  return EXT_RE.test(ext) ? ext : null;
}

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);

    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }

  return false;
}

/**
 * Throw unless `key` is a safe, relative, single-bucket object key.
 * Rejects leading slashes, `..`, backslashes, empty/`.`/`..` segments, `//`,
 * control characters, and anything outside the S3-safe character set.
 */
export function assertSafeObjectKey(key: string): void {
  if (typeof key !== "string" || key.length === 0) {
    throw new UnsafeObjectKeyError("empty");
  }

  if (key.length > MAX_KEY_LENGTH) {
    throw new UnsafeObjectKeyError("too long");
  }

  if (key.startsWith("/")) {
    throw new UnsafeObjectKeyError("must not start with a slash");
  }

  if (key.includes("\\")) {
    throw new UnsafeObjectKeyError("backslash is not allowed");
  }

  if (key.includes("//")) {
    throw new UnsafeObjectKeyError("empty path segment");
  }

  if (hasControlCharacter(key)) {
    throw new UnsafeObjectKeyError("control character");
  }

  for (const segment of key.split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      throw new UnsafeObjectKeyError("path traversal segment");
    }
  }

  if (!SAFE_KEY_RE.test(key)) {
    throw new UnsafeObjectKeyError("disallowed character");
  }
}

export type GeneratedKey = { key: string; uuid: string; ext: string };

/**
 * Build a fresh, collision-resistant object key for `kind` + `entityId`.
 * The original file name only contributes the extension (for variable-extension
 * kinds), and even that is sanitised.
 */
export function generateObjectKey(input: {
  kind: UploadKind;
  entityId: string;
  originalFileName: string;
}): GeneratedKey {
  const layout = KEY_LAYOUT[input.kind];

  if (!layout) {
    throw new InvalidUploadKindError(input.kind);
  }

  if (!isUuid(input.entityId)) {
    throw new InvalidEntityIdError();
  }

  let ext = layout.fixedExt;

  if (!ext) {
    ext = extensionFromFileName(input.originalFileName ?? "");

    if (!ext) {
      throw new UnsafeObjectKeyError("missing file extension");
    }
  }

  const uuid = globalThis.crypto.randomUUID();
  const fileName = `${uuid}.${ext}`;

  const key = [layout.prefix, input.entityId, layout.segment, fileName]
    .filter((part): part is string => Boolean(part))
    .join("/");

  assertSafeObjectKey(key);

  return { key, uuid, ext };
}

/**
 * True when `key` structurally matches the layout for `kind`. Used by `finalize`
 * as defence-in-depth so a caller cannot pair an arbitrary key with a lax kind.
 */
export function keyMatchesKind(key: string, kind: UploadKind): boolean {
  const layout = KEY_LAYOUT[kind];

  if (!layout) {
    return false;
  }

  try {
    assertSafeObjectKey(key);
  } catch {
    return false;
  }

  const segment = layout.segment ? `${layout.segment}/` : "";
  const ext = layout.fixedExt ? escapeRegExp(layout.fixedExt) : "[a-z0-9]{1,8}";
  const pattern = new RegExp(`^${layout.prefix}/${UUID_SOURCE}/${segment}${UUID_SOURCE}\\.${ext}$`);

  return pattern.test(key);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
