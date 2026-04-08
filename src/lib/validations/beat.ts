import { z } from "zod";

export const beatFormSchema = z.object({
  title: z.string().min(2),
  bpm: z.number().min(40).max(240),
  mood: z.string().min(2),
  status: z.enum(["available", "reserved", "sold", "private"]),
  priceUsd: z.number().min(0),
});

export type BeatFormValues = z.infer<typeof beatFormSchema>;