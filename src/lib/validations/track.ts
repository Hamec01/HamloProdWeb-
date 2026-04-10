import { z } from "zod";

const optionalUrl = z.string().trim().refine((value) => value.length === 0 || z.url().safeParse(value).success, {
  message: "Invalid URL",
});

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

export const trackFormSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  artistName: z.string().min(2),
  coverPalette: z.string().min(2),
  coverImageUrl: nullableUrl,
  coverImagePath: nullableText,
  mp3FilePath: nullableText,
  spotifyUrl: optionalUrl,
  appleMusicUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  releaseDate: z.string().min(4),
});

export type TrackFormValues = z.infer<typeof trackFormSchema>;