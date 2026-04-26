import { PREVIEW_ALLOWED_EXTENSIONS, PREVIEW_ALLOWED_MIME_TYPES } from "@/lib/validations/beat";

export function isAllowedPreviewMimeType(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return PREVIEW_ALLOWED_MIME_TYPES.includes(value as (typeof PREVIEW_ALLOWED_MIME_TYPES)[number]);
}

export function hasAllowedPreviewExtension(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const lower = value.toLowerCase();
  return PREVIEW_ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isHttpsUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
