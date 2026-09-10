"use client";

import type { AdminBeat } from "@/types/beat";
import type { BeatAssetKind } from "@/lib/data/repositories/upload-intent.repository";

export type UploadOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (percent: number) => void;
};
async function post(url: string, body: unknown, signal: AbortSignal) {
  const response = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Upload request failed (${response.status}).`);
  if (!data) throw new Error("Invalid upload response.");
  return data;
}
function putWithProgress(url: string, headers: Record<string, string>, file: File, signal: AbortSignal, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => { xhr.abort(); finish(signal.reason ?? new DOMException("Upload cancelled", "AbortError")); };
    const finish = (error?: unknown) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error); else resolve();
    };
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300 ? undefined : new Error(`File upload failed (${xhr.status}).`));
    xhr.onerror = () => finish(new Error("File upload failed. Check connection and storage CORS."));
    xhr.onabort = () => finish(signal.reason ?? new DOMException("Upload cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    xhr.send(file);
  });
}
const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav", zip: "application/zip" };

/** Bytes go directly to storage. Only metadata is sent to the application. */
export async function uploadBeatAsset(beatId: string, kind: BeatAssetKind, file: File, options: UploadOptions = {}): Promise<AdminBeat> {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timeout = setTimeout(() => controller.abort(new DOMException("Upload timed out", "TimeoutError")), options.timeoutMs ?? 30 * 60_000);
  const signal = controller.signal;
  try {
    signal.throwIfAborted();
    options.onProgress?.(0);
    const contentType = file.type || MIME_BY_EXT[file.name.split(".").at(-1)?.toLowerCase() ?? ""] || "application/octet-stream";
    const prepared = await post("/api/admin/storage/upload-url", { kind, entityId: beatId, originalFileName: file.name, contentType, size: file.size }, signal);
    if (options.onProgress) {
      await putWithProgress(prepared.upload.url, prepared.upload.headers, file, signal, options.onProgress);
    } else {
      const response = await fetch(prepared.upload.url, { method: "PUT", headers: prepared.upload.headers, body: file, signal, credentials: "omit" });
      if (!response.ok) throw new Error(`File upload failed (${response.status}).`);
    }
    await post("/api/admin/storage/finalize", { key: prepared.key, kind }, signal);
    const attached = await post(`/api/admin/beats/${encodeURIComponent(beatId)}/assets`, { kind, key: prepared.key }, signal);
    return attached.beat;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

export type AdminAssetKind = "track-cover" | "track-audio" | "artist-avatar" | "post-file";

/**
 * Generic admin media upload (track / release / post / artist). Returns the
 * server-generated object key + its public URL (null for private audio). The key
 * is then submitted in the entity's metadata payload. No UploadIntent — admin
 * routes are trusted.
 */
export async function uploadAdminAsset(
  kind: AdminAssetKind,
  entityId: string,
  file: File,
  options: UploadOptions = {},
): Promise<{ key: string; publicUrl: string | null }> {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timeout = setTimeout(() => controller.abort(new DOMException("Upload timed out", "TimeoutError")), options.timeoutMs ?? 30 * 60_000);
  const signal = controller.signal;
  try {
    signal.throwIfAborted();
    options.onProgress?.(0);
    const contentType = file.type || MIME_BY_EXT[file.name.split(".").at(-1)?.toLowerCase() ?? ""] || "application/octet-stream";
    const prepared = await post("/api/admin/storage/asset-url", { kind, entityId, originalFileName: file.name, contentType, size: file.size }, signal);
    if (options.onProgress) {
      await putWithProgress(prepared.upload.url, prepared.upload.headers, file, signal, options.onProgress);
    } else {
      const response = await fetch(prepared.upload.url, { method: "PUT", headers: prepared.upload.headers, body: file, signal, credentials: "omit" });
      if (!response.ok) throw new Error(`File upload failed (${response.status}).`);
    }
    const confirmed = await post("/api/admin/storage/asset-confirm", { key: prepared.key, kind }, signal);
    return { key: confirmed.key as string, publicUrl: (confirmed.publicUrl as string | null) ?? null };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
