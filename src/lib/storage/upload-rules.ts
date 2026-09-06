/**
 * Server-side upload policy. The browser is never trusted for MIME, size or
 * visibility — every direct upload is checked against this table before a
 * presigned URL is issued and again (against the real object) at finalize.
 *
 * The four `beat-*` rules are the authoritative set for M7.1. The `track-*`,
 * `artist-*` and `post-*` rules are provisional and finalised when their admin
 * UIs move to Contabo (M7.2+).
 */

import type { StorageVisibility } from "./object-storage";
import type { UploadKind } from "./keys";

const MB = 1024 * 1024;
const GB = 1024 * MB;

export type UploadRule = {
  kind: UploadKind;
  visibility: StorageVisibility;
  /** Allowed request Content-Type values (exact match, lower-cased). */
  mimeTypes: readonly string[];
  /** Allowed file extensions, lower-cased, without the dot. */
  extensions: readonly string[];
  maxBytes: number;
  /** Human label for docs / error copy. */
  label: string;
  provisional?: boolean;
};

export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  "beat-cover": {
    kind: "beat-cover",
    visibility: "public",
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    extensions: ["jpg", "jpeg", "png", "webp"],
    maxBytes: 10 * MB,
    label: "Beat cover image",
  },
  "beat-preview": {
    kind: "beat-preview",
    visibility: "public",
    mimeTypes: ["audio/mpeg"],
    extensions: ["mp3"],
    maxBytes: 30 * MB,
    label: "Beat preview (MP3)",
  },
  "beat-master": {
    kind: "beat-master",
    visibility: "private",
    mimeTypes: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
    extensions: ["wav"],
    maxBytes: 500 * MB,
    label: "Beat master (WAV)",
  },
  "beat-archive": {
    kind: "beat-archive",
    visibility: "private",
    mimeTypes: ["application/zip", "application/x-zip-compressed"],
    extensions: ["zip"],
    maxBytes: 2 * GB,
    label: "Beat archive (ZIP)",
  },

  // ---- provisional (M7.2+) ----
  "track-cover": {
    kind: "track-cover",
    visibility: "public",
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    extensions: ["jpg", "jpeg", "png", "webp"],
    maxBytes: 10 * MB,
    label: "Track cover image",
    provisional: true,
  },
  "track-audio": {
    kind: "track-audio",
    visibility: "private",
    mimeTypes: ["audio/mpeg"],
    extensions: ["mp3"],
    maxBytes: 30 * MB,
    label: "Track audio (MP3)",
    provisional: true,
  },
  "artist-avatar": {
    kind: "artist-avatar",
    visibility: "public",
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    extensions: ["jpg", "jpeg", "png", "webp"],
    maxBytes: 10 * MB,
    label: "Artist avatar",
    provisional: true,
  },
  "post-file": {
    kind: "post-file",
    visibility: "public",
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "audio/mpeg"],
    extensions: ["jpg", "jpeg", "png", "webp", "mp3"],
    maxBytes: 30 * MB,
    label: "Post media",
    provisional: true,
  },
};

export class UnknownUploadKindError extends Error {
  readonly code = "INVALID_UPLOAD_KIND";

  constructor(kind: string) {
    super(`Unknown upload kind: ${JSON.stringify(kind)}`);
    this.name = "UnknownUploadKindError";
  }
}

export function getUploadRule(kind: UploadKind): UploadRule {
  const rule = UPLOAD_RULES[kind];

  if (!rule) {
    throw new UnknownUploadKindError(kind);
  }

  return rule;
}

export function visibilityForKind(kind: UploadKind): StorageVisibility {
  return getUploadRule(kind).visibility;
}

/** Select the bucket purely from visibility — never from a client-supplied value. */
export function bucketForVisibility(
  visibility: StorageVisibility,
  config: { publicBucket: string; privateBucket: string },
): string {
  return visibility === "public" ? config.publicBucket : config.privateBucket;
}

export type UploadValidationInput = {
  kind: UploadKind;
  contentType: string;
  originalFileName: string;
  size: number;
};

export type UploadValidationResult =
  | { ok: true; rule: UploadRule; extension: string; contentType: string }
  | { ok: false; code: UploadValidationCode; message: string };

export type UploadValidationCode =
  | "INVALID_UPLOAD_KIND"
  | "INVALID_CONTENT_TYPE"
  | "INVALID_EXTENSION"
  | "EXTENSION_MIME_MISMATCH"
  | "INVALID_SIZE"
  | "FILE_TOO_LARGE";

function normalizeContentType(raw: string): string {
  return raw.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function extensionOf(fileName: string): string | null {
  const dot = fileName.lastIndexOf(".");

  if (dot < 0 || dot === fileName.length - 1) {
    return null;
  }

  return fileName.slice(dot + 1).toLowerCase();
}

/** Which extensions are plausible for a given (already-allowed) MIME type. */
const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "audio/mpeg": ["mp3"],
  "audio/wav": ["wav"],
  "audio/x-wav": ["wav"],
  "audio/wave": ["wav"],
  "audio/vnd.wave": ["wav"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
};

/**
 * Validate a direct-upload request against the rule for its kind: MIME, extension,
 * size, and MIME/extension agreement. Returns a discriminated result, never throws
 * for validation failures (only for an unknown kind via {@link getUploadRule}).
 */
export function validateUploadRequest(input: UploadValidationInput): UploadValidationResult {
  const rule = UPLOAD_RULES[input.kind];

  if (!rule) {
    return { ok: false, code: "INVALID_UPLOAD_KIND", message: `Unknown upload kind: ${String(input.kind)}` };
  }

  const contentType = normalizeContentType(input.contentType ?? "");

  if (!contentType || !rule.mimeTypes.includes(contentType)) {
    return {
      ok: false,
      code: "INVALID_CONTENT_TYPE",
      message: `${rule.label} must be one of: ${rule.mimeTypes.join(", ")}.`,
    };
  }

  const extension = extensionOf(input.originalFileName ?? "");

  if (!extension || !rule.extensions.includes(extension)) {
    return {
      ok: false,
      code: "INVALID_EXTENSION",
      message: `${rule.label} file extension must be one of: ${rule.extensions.map((ext) => `.${ext}`).join(", ")}.`,
    };
  }

  const allowedForMime = MIME_EXTENSIONS[contentType];

  if (allowedForMime && !allowedForMime.includes(extension)) {
    return {
      ok: false,
      code: "EXTENSION_MIME_MISMATCH",
      message: `File extension .${extension} does not match content type ${contentType}.`,
    };
  }

  if (!Number.isInteger(input.size) || input.size <= 0) {
    return { ok: false, code: "INVALID_SIZE", message: "File size must be a positive integer number of bytes." };
  }

  if (input.size > rule.maxBytes) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `${rule.label} exceeds the ${formatBytes(rule.maxBytes)} limit.`,
    };
  }

  return { ok: true, rule, extension, contentType };
}

/** Validate a finalized object's real head metadata against the rule for its kind. */
export function validateFinalizedObject(input: {
  kind: UploadKind;
  contentType: string | null;
  contentLength: number | null;
}): UploadValidationResult {
  const rule = UPLOAD_RULES[input.kind];

  if (!rule) {
    return { ok: false, code: "INVALID_UPLOAD_KIND", message: `Unknown upload kind: ${String(input.kind)}` };
  }

  const contentType = normalizeContentType(input.contentType ?? "");

  if (!contentType || !rule.mimeTypes.includes(contentType)) {
    return {
      ok: false,
      code: "INVALID_CONTENT_TYPE",
      message: `Stored object content type is not allowed for ${rule.label}.`,
    };
  }

  if (input.contentLength === null || !Number.isFinite(input.contentLength) || input.contentLength <= 0) {
    return { ok: false, code: "INVALID_SIZE", message: "Stored object has no readable size." };
  }

  if (input.contentLength > rule.maxBytes) {
    return { ok: false, code: "FILE_TOO_LARGE", message: `Stored object exceeds the ${formatBytes(rule.maxBytes)} limit.` };
  }

  return { ok: true, rule, extension: rule.extensions[0], contentType };
}

export function formatBytes(bytes: number): string {
  if (bytes >= GB) {
    return `${bytes / GB} GB`;
  }

  return `${Math.round(bytes / MB)} MB`;
}
