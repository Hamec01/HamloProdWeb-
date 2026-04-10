import { z } from "zod";

const nullableText = z.preprocess((value) => {
  if (value === "") {
    return null;
  }

  return value;
}, z.string().trim().min(1).nullable());

export const beatFormSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  caseNumber: z.string().min(2),
  coverPalette: z.string().min(2),
  previewUrl: z.url(),
  previewStoragePath: nullableText,
  wavFilePath: nullableText,
  zipFilePath: nullableText,
  bpm: z.number().min(40).max(240),
  mood: z.string().min(2),
  description: z.string().min(10),
  duration: z.string().min(4),
  status: z.enum(["available", "reserved", "sold", "private"]),
  priceUsd: z.number().min(0),
  featured: z.boolean(),
});

export type BeatFormValues = z.infer<typeof beatFormSchema>;