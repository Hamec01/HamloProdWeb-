import { z } from "zod";

export const PREVIEW_MAX_SIZE_BYTES = 20 * 1024 * 1024;
export const PREVIEW_ALLOWED_MIME_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"] as const;
export const PREVIEW_ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a"] as const;

const nullableText = z.string().trim().nullable().transform((value) => {
  if (!value) {
    return null;
  }

  return value.length > 0 ? value : null;
});

const nullableUrl = z
  .string()
  .trim()
  .nullable()
  .transform((value) => {
    if (!value) {
      return null;
    }

    return value;
  })
  .refine((value) => value === null || z.url().safeParse(value).success, {
    message: "Invalid URL",
  });

export const beatFormSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  caseNumber: z.string().min(2),
  coverPalette: z.string().min(2),
  coverImageUrl: nullableUrl,
  coverImagePath: nullableText,
  previewUrl: nullableUrl,
  previewStoragePath: nullableText,
  previewFileName: nullableText,
  previewMimeType: nullableText.refine((value) => value === null || PREVIEW_ALLOWED_MIME_TYPES.includes(value as (typeof PREVIEW_ALLOWED_MIME_TYPES)[number]), {
    message: "Unsupported preview mime type",
  }),
  previewSizeBytes: z
    .union([z.number(), z.string(), z.null()])
    .refine((value) => {
      if (value === null || value === "") {
        return true;
      }

      const numericValue = typeof value === "number" ? value : Number(value);
      return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= PREVIEW_MAX_SIZE_BYTES;
    }, { message: "Preview size exceeds limit" }),
  wavFilePath: nullableText,
  zipFilePath: nullableText,
  genre: z.enum(["boombap", "rap", "trap", "drill", "another"]),
  substyle: z.string().min(2),
  bpm: z.number().min(40).max(240),
  mood: z.string().min(2),
  description: z.string().min(10),
  duration: z.string().min(4),
  status: z.enum(["available", "reserved", "sold", "private"]),
  priceUsd: z.number().min(0),
  priceRub: z.number().min(0),
  featured: z.boolean(),
  availableForDownload: z.boolean(),
});

export type BeatFormValues = z.infer<typeof beatFormSchema>;