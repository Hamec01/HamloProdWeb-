/** In-memory repository used only by unit tests. */
import type { UploadIntentRecord, UploadIntentRepository, PendingUpload } from "@/lib/data/repositories/upload-intent.repository";
export class TestIntents implements UploadIntentRepository {
  rows = new Map<string, UploadIntentRecord>();
  async createPending(input: PendingUpload) { this.rows.set(input.key, { ...input, state: "PENDING", actualSize: null, finalizedAt: null }); }
  async findByKey(key: string) { return this.rows.get(key) ?? null; }
  async markFinalized(key: string, actualSize: number) {
    const row = this.rows.get(key);
    if (!row || row.state !== "PENDING" || row.expiresAt <= new Date()) return false;
    Object.assign(row, { actualSize, state: "FINALIZED", finalizedAt: new Date() });
    return true;
  }
  async markAttached(key: string) {
    const row = this.rows.get(key);
    if (!row || row.state !== "FINALIZED") return false;
    row.state = "ATTACHED"; return true;
  }
  async expireStale() { return [...this.rows.values()].filter(r => r.state === "DELETING"); }
  async markExpired(key: string) { this.rows.get(key)!.state = "EXPIRED"; }
  async attachBeatAsset() { return null; }
}
