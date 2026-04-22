import { z } from "zod";

const optionalUrl = z.string().trim().refine((value) => value.length === 0 || z.url().safeParse(value).success, {
  message: "Invalid URL",
});

const nullableText = z
  .string()
  .trim()
  .nullable()
  .transform((value) => (value && value.length > 0 ? value : null));

const nullableUrl = z
  .string()
  .trim()
  .nullable()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => value === null || z.url().safeParse(value).success, {
    message: "Invalid URL",
  });

export const releaseTrackItemSchema = z.object({
  title: z.string().min(1, "Обязательное поле"),
  slug: z.string().min(1, "Обязательное поле"),
  trackNumber: z.number().int().min(1),
  mp3FilePath: nullableText,
});

export const releaseFormSchema = z.object({
  title: z.string().min(2, "Минимум 2 символа"),
  slug: z.string().min(2, "Минимум 2 символа"),
  artistName: z.string().min(1, "Обязательное поле"),
  releaseType: z.enum(["album", "ep", "mixtape"]),
  coverPalette: z.string().min(2),
  coverImageUrl: nullableUrl,
  coverImagePath: nullableText,
  description: z.string(),
  spotifyUrl: optionalUrl,
  appleMusicUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  releaseDate: z.string().min(4),
  published: z.boolean(),
  featured: z.boolean(),
  tracks: z.array(releaseTrackItemSchema).min(1, "Добавьте хотя бы один трек"),
});

export type ReleaseTrackItemValues = z.infer<typeof releaseTrackItemSchema>;
export type ReleaseFormValues = z.infer<typeof releaseFormSchema>;
