export const MEDIA_IMAGES_BUCKET = "media-images";
export const BEAT_PREVIEWS_BUCKET = "beat-previews";
export const BEAT_DOWNLOADS_BUCKET = "beat-downloads";
export const TRACK_DOWNLOADS_BUCKET = "track-downloads";

function sanitizeFileNameSegment(segment: string) {
  return segment.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
}

export function buildStoragePath(recordSlug: string, kind: string, fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  const hasExtension = lastDotIndex > -1;
  const extension = hasExtension ? fileName.slice(lastDotIndex).toLowerCase() : "";
  const baseName = hasExtension ? fileName.slice(0, lastDotIndex) : fileName;

  return `${sanitizeFileNameSegment(recordSlug)}/${kind}-${Date.now()}-${sanitizeFileNameSegment(baseName)}${extension}`;
}

export function getPendingUploadUrl(fileName: string) {
  return `https://upload.local/${sanitizeFileNameSegment(fileName)}`;
}