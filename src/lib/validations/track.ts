import { z } from "zod";

export const trackFormSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  artistName: z.string().min(2),
  coverPalette: z.string().min(2),
  spotifyUrl: z.url(),
  appleMusicUrl: z.url(),
  youtubeUrl: z.url(),
  releaseDate: z.string().min(4),
});

export type TrackFormValues = z.infer<typeof trackFormSchema>;