import type { UploadIntentRepository } from "@/lib/data/repositories/upload-intent.repository";
import type { ObjectStorage } from "./object-storage";

/** Durable DELETING rows survive failures; no credentials or signed URLs in logs. */
export async function sweepUploads(intents: UploadIntentRepository, storage: Pick<ObjectStorage, "deleteObject">, limit = 20) {
  const rows = await intents.expireStale(limit);
  let deleted = 0;
  for (const row of rows) {
    try {
      await storage.deleteObject({ key: row.key, visibility: row.visibility });
      await intents.markExpired(row.key);
      deleted++;
    } catch { /* Retry on the next sweep. */ }
  }
  return { examined: rows.length, deleted };
}
let lastSweep = 0;
let running = false;
export async function opportunisticUploadSweep(intents: UploadIntentRepository, storage: Pick<ObjectStorage, "deleteObject">) {
  if (running || Date.now() - lastSweep < 60_000) return;
  running = true;
  lastSweep = Date.now();
  try { await sweepUploads(intents, storage); }
  catch { /* Storage cleanup must not fail an otherwise successful request. */ }
  finally { running = false; }
}
