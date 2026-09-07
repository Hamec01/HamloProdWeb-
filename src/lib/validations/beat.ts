import { z } from "zod";

// Preview-audio limits — still consumed by src/lib/validations/preview-audio.ts
// and the M7.2 upload rules.
export const PREVIEW_MAX_SIZE_BYTES = 20 * 1024 * 1024;
export const PREVIEW_ALLOWED_MIME_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"] as const;
export const PREVIEW_ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// M2 — metadata-only schema. No object keys / paths / URLs: cover / preview /
// master / archive are attached later through a verified UploadIntent (M7.2).
// ─────────────────────────────────────────────────────────────────────────────

export const BEAT_GENRE_VALUES = ["boombap", "rap", "trap", "drill", "another"] as const;
export const BEAT_STATUS_VALUES = ["available", "reserved", "sold", "private"] as const;

export const BPM_MIN = 40;
export const BPM_MAX = 300;
export const DURATION_MAX_SECONDS = 60 * 60; // 1 hour

const slugField = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase latin words separated by single hyphens");
const titleField = z.string().trim().min(2).max(200);
const caseNumberField = z.string().trim().min(2).max(60);
const coverPaletteField = z.string().trim().min(2).max(200);
const bpmField = z.number().int().min(BPM_MIN).max(BPM_MAX);
const durationField = z.number().int().min(0).max(DURATION_MAX_SECONDS);
const priceUsdField = z.number().int().min(0).max(1_000_000);
const priceRubField = z.number().int().min(0).max(100_000_000);

/** Create: text metadata fields default to null / the default palette; `status` optional (⇒ private). */
export const beatCreateSchema = z
  .object({
    title: titleField,
    slug: slugField,
    caseNumber: caseNumberField,
    coverPalette: coverPaletteField.optional().default("from-stone-700 via-stone-900 to-zinc-950"),
    genre: z.enum(BEAT_GENRE_VALUES),
    substyle: z.string().trim().min(1).max(80).nullish().transform((v) => v ?? null),
    mood: z.string().trim().min(1).max(120).nullish().transform((v) => v ?? null),
    bpm: bpmField.nullish().transform((v) => v ?? null),
    description: z.string().trim().min(1).max(5000).nullish().transform((v) => v ?? null),
    durationSeconds: durationField.nullish().transform((v) => v ?? null),
    priceUsd: priceUsdField,
    priceRub: priceRubField,
    status: z.enum(BEAT_STATUS_VALUES).optional(),
    featured: z.boolean().optional().default(false),
    availableForDownload: z.boolean().optional().default(false),
  })
  .strict();

/** Update: absent key ⇒ leave unchanged; explicit `null` ⇒ clear the field. */
export const beatUpdateSchema = z
  .object({
    title: titleField.optional(),
    slug: slugField.optional(),
    caseNumber: caseNumberField.optional(),
    coverPalette: coverPaletteField.optional(),
    genre: z.enum(BEAT_GENRE_VALUES).optional(),
    substyle: z.string().trim().min(1).max(80).nullable().optional(),
    mood: z.string().trim().min(1).max(120).nullable().optional(),
    bpm: bpmField.nullable().optional(),
    description: z.string().trim().min(1).max(5000).nullable().optional(),
    durationSeconds: durationField.nullable().optional(),
    priceUsd: priceUsdField.optional(),
    priceRub: priceRubField.optional(),
    status: z.enum(BEAT_STATUS_VALUES).optional(),
    featured: z.boolean().optional(),
    availableForDownload: z.boolean().optional(),
  })
  .strict();

export type BeatCreateValues = z.infer<typeof beatCreateSchema>;
export type BeatUpdateValues = z.infer<typeof beatUpdateSchema>;