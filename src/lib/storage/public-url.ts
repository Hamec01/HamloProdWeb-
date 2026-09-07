/**
 * Resolve a PUBLIC object key to an absolute URL. Server-only.
 *
 * Returns `null` when the key is empty, unsafe, or object storage is not
 * configured yet (files are attached in M7.2). Private keys must never be passed
 * here — callers only ever resolve `coverKey` / `previewKey`.
 */

import { getS3Config } from "./config";
import { assertSafeObjectKey } from "./keys";

export function resolvePublicObjectUrl(key: string | null | undefined): string | null {
  if (!key) {
    return null;
  }

  try {
    assertSafeObjectKey(key);
    const { publicBaseUrl } = getS3Config();
    return `${publicBaseUrl.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
  } catch {
    return null;
  }
}
