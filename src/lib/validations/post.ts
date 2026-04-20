import { z } from "zod";
import { postSections } from "@/types/post";

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

export const postFormSchema = z.object({
  title: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  excerpt: z.string().trim().min(10),
  content: z.string().trim().min(20),
  category: z.string().trim().min(2),
  section: z.enum(postSections),
  coverPalette: z.string().trim().min(2),
  ctaLabel: nullableText,
  ctaUrl: nullableUrl,
  published: z.boolean(),
  featured: z.boolean(),
});

export type PostFormValues = z.infer<typeof postFormSchema>;
