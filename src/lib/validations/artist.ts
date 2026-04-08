import { z } from "zod";

export const artistFormSchema = z.object({
  artistName: z.string().min(2),
  trackTitle: z.string().min(2),
  beatTitle: z.string().min(2),
  coverPalette: z.string().min(2),
  spotifyUrl: z.url(),
  appleMusicUrl: z.url(),
  youtubeUrl: z.url(),
});

export type ArtistFormValues = z.infer<typeof artistFormSchema>;