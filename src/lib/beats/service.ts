/**
 * Beat metadata and asset service — PostgreSQL only, no Supabase, no mock fallback.
 *
 * Owns validation, normalisation, the publish/status rules and the delete rules.
 * The Route Handlers do auth + origin (via requireAdminMutation) and translate
 * the discriminated result to HTTP.
 */

import { isAdminRole, type AdminRole } from "@/lib/auth/admin-roles";
import { beatCreateSchema, beatUpdateSchema } from "@/lib/validations/beat";
import { PrismaBeatRepository, isUniqueViolation } from "@/lib/data/postgres/beat.postgres";
import type {
  BeatCreateInput,
  BeatRepository,
  BeatUpdateInput,
} from "@/lib/data/repositories/beat.repository";
import { toAdminBeat, toPublicBeat } from "@/lib/data/beat-mappers";
import { resolvePublicObjectUrl } from "@/lib/storage/public-url";
import { PrismaUploadIntentRepository } from "@/lib/data/postgres/upload-intent.postgres";
import { isBeatAssetKind, type UploadIntentRepository } from "@/lib/data/repositories/upload-intent.repository";
import { isUuid, keyMatchesKind } from "@/lib/storage/keys";
import type { AdminBeat, Beat, BeatStatus } from "@/types/beat";

export type BeatServiceFailure = {
  ok: false;
  status: 403 | 404 | 409 | 422;
  error: string;
  code?: string;
};
export type BeatServiceOk<T> = { ok: true; data: T };
export type BeatServiceResult<T> = BeatServiceOk<T> | BeatServiceFailure;

const PUBLIC_STATUSES: BeatStatus[] = ["available", "reserved"];
const UNDELETABLE_STATUSES: BeatStatus[] = ["reserved", "sold"];
const MAX_LIMIT = 100;

function clampLimit(value: number | undefined): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 20;
  return Math.min(MAX_LIMIT, Math.max(1, n));
}

function clampOffset(value: number | undefined): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.max(0, n);
}

function fail(status: BeatServiceFailure["status"], error: string, code?: string): BeatServiceFailure {
  return { ok: false, status, error, code };
}

export class BeatService {
  constructor(private readonly repo: BeatRepository = new PrismaBeatRepository(), private readonly intents: UploadIntentRepository = new PrismaUploadIntentRepository()) {}

  async attachAsset(beatId: string, kind: unknown, key: unknown, actorRole: AdminRole, ownerId: string): Promise<BeatServiceResult<AdminBeat>> {
    if (!isAdminRole(actorRole)) return fail(403, "Forbidden");
    if (!isUuid(beatId) || !isBeatAssetKind(kind) || typeof key !== "string" || !keyMatchesKind(key, kind) || key.split("/")[1] !== beatId) return fail(422, "Storage key does not match this beat and kind.", "KEY_KIND_MISMATCH");
    if (!await this.repo.findById(beatId)) return fail(404, "Beat not found.", "NOT_FOUND");
    const intent = await this.intents.findByKey(key);
    if (!intent || intent.ownerId !== ownerId || intent.entityType !== "beat" || intent.entityId !== beatId) return fail(403, "Upload does not belong to this owner and beat.", "UPLOAD_OWNER_MISMATCH");
    if (intent.state !== "FINALIZED" || intent.kind !== kind || intent.expiresAt <= new Date()) return fail(409, "Upload must be finalized before attachment.", "INVALID_UPLOAD_STATE");
    const record = await this.intents.attachBeatAsset(beatId, kind, key, ownerId);
    if (!record) return fail(409, "Upload can no longer be attached.", "INVALID_UPLOAD_STATE");
    return { ok: true, data: toAdminBeat(record, BeatService.resolveUrl) };
  }

  // ── public catalogue ──────────────────────────────────────────────────────

  private static resolveUrl(key: string | null): string | null {
    return resolvePublicObjectUrl(key);
  }

  async listPublic(query: { limit?: number; offset?: number } = {}): Promise<Beat[]> {
    const page = await this.repo.list({
      limit: clampLimit(query.limit),
      offset: clampOffset(query.offset),
      statusIn: PUBLIC_STATUSES,
      publishedOnly: true,
    });
    return page.items.map((record) => toPublicBeat(record, BeatService.resolveUrl));
  }

  async getPublicBySlug(slug: string): Promise<Beat | null> {
    const record = await this.repo.findBySlug(slug.trim());
    if (!record || !record.publishedAt || !PUBLIC_STATUSES.includes(record.status)) {
      return null;
    }
    return toPublicBeat(record, BeatService.resolveUrl);
  }

  // ── admin ─────────────────────────────────────────────────────────────────

  async listAdmin(query: {
    limit?: number;
    offset?: number;
    status?: BeatStatus;
    featured?: boolean;
  } = {}): Promise<{ items: AdminBeat[]; total: number }> {
    const page = await this.repo.list({
      limit: clampLimit(query.limit),
      offset: clampOffset(query.offset),
      status: query.status,
      featured: query.featured,
    });
    return {
      items: page.items.map((record) => toAdminBeat(record, BeatService.resolveUrl)),
      total: page.total,
    };
  }

  async getAdminById(id: string): Promise<AdminBeat | null> {
    const record = await this.repo.findById(id);
    return record ? toAdminBeat(record, BeatService.resolveUrl) : null;
  }

  async create(rawInput: unknown, actorRole: AdminRole): Promise<BeatServiceResult<AdminBeat>> {
    if (!isAdminRole(actorRole)) {
      return fail(403, "Forbidden");
    }

    const parsed = beatCreateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return fail(422, parsed.error.issues[0]?.message ?? "Invalid payload.", "INVALID_PAYLOAD");
    }

    const values = parsed.data;
    // Public availability requires attached cover and preview assets.
    const status: BeatStatus = values.status ?? "private";
    if (status === "available") return fail(409, "Attach a cover and preview before publishing.", "MISSING_REQUIRED_ASSETS");

    const input: BeatCreateInput = {
      slug: values.slug,
      caseNumber: values.caseNumber,
      title: values.title,
      status,
      genre: values.genre,
      substyle: values.substyle,
      mood: values.mood,
      bpm: values.bpm,
      description: values.description,
      durationSeconds: values.durationSeconds,
      coverPalette: values.coverPalette,
      priceUsd: values.priceUsd,
      priceRub: values.priceRub,
      featured: values.featured,
      availableForDownload: values.availableForDownload,
      publishedAt: status !== "private" ? new Date() : null,
    };

    try {
      const record = await this.repo.create(input);
      return { ok: true, data: toAdminBeat(record, BeatService.resolveUrl) };
    } catch (error) {
      const unique = isUniqueViolation(error);
      if (unique) {
        return fail(409, `A beat with this ${unique.target === "caseNumber" ? "case number" : "slug"} already exists.`, "DUPLICATE");
      }
      throw error;
    }
  }

  async update(id: string, rawInput: unknown, actorRole: AdminRole): Promise<BeatServiceResult<AdminBeat>> {
    if (!isAdminRole(actorRole)) {
      return fail(403, "Forbidden");
    }

    const parsed = beatUpdateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return fail(422, parsed.error.issues[0]?.message ?? "Invalid payload.", "INVALID_PAYLOAD");
    }

    const existing = await this.repo.findById(id);
    if (!existing) {
      return fail(404, "Beat not found.", "NOT_FOUND");
    }

    const values = parsed.data;
    if (values.status === "available" && (!existing.coverKey || !existing.previewKey)) return fail(409, "Attach a cover and preview before publishing.", "MISSING_REQUIRED_ASSETS");
    const input: BeatUpdateInput = {};

    if (values.title !== undefined) input.title = values.title;
    if (values.slug !== undefined) input.slug = values.slug;
    if (values.caseNumber !== undefined) input.caseNumber = values.caseNumber;
    if (values.coverPalette !== undefined) input.coverPalette = values.coverPalette;
    if (values.genre !== undefined) input.genre = values.genre;
    if (values.substyle !== undefined) input.substyle = values.substyle;
    if (values.mood !== undefined) input.mood = values.mood;
    if (values.bpm !== undefined) input.bpm = values.bpm;
    if (values.description !== undefined) input.description = values.description;
    if (values.durationSeconds !== undefined) input.durationSeconds = values.durationSeconds;
    if (values.priceUsd !== undefined) input.priceUsd = values.priceUsd;
    if (values.priceRub !== undefined) input.priceRub = values.priceRub;
    if (values.featured !== undefined) input.featured = values.featured;
    if (values.availableForDownload !== undefined) input.availableForDownload = values.availableForDownload;

    if (values.status !== undefined) {
      input.status = values.status;
      // publishedAt is set once, the first time the beat leaves `private`, and
      // never cleared afterwards.
      if (values.status !== "private" && existing.publishedAt === null) {
        input.publishedAt = new Date();
      }
    }

    try {
      const record = await this.repo.update(id, input);
      if (!record) {
        return fail(404, "Beat not found.", "NOT_FOUND");
      }
      return { ok: true, data: toAdminBeat(record, BeatService.resolveUrl) };
    } catch (error) {
      const unique = isUniqueViolation(error);
      if (unique) {
        return fail(409, `A beat with this ${unique.target === "caseNumber" ? "case number" : "slug"} already exists.`, "DUPLICATE");
      }
      throw error;
    }
  }

  async delete(id: string, actorRole: AdminRole): Promise<BeatServiceResult<{ id: string }>> {
    if (!isAdminRole(actorRole)) {
      return fail(403, "Forbidden");
    }

    const existing = await this.repo.findById(id);
    if (!existing) {
      return fail(404, "Beat not found.", "NOT_FOUND");
    }

    if (UNDELETABLE_STATUSES.includes(existing.status)) {
      return fail(409, `A ${existing.status} beat cannot be deleted through CRUD.`, "STATUS_LOCKED");
    }

    const deleted = await this.repo.delete(id);
    if (!deleted) {
      return fail(404, "Beat not found.", "NOT_FOUND");
    }

    return { ok: true, data: { id } };
  }
}
