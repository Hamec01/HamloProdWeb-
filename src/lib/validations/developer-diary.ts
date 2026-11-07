import { z } from "zod";

export const diaryEntrySchema = z.object({
  title: z.string().trim().min(2, "Укажи заголовок (минимум 2 символа).").max(200),
  content: z.string().trim().min(1, "Напиши текст записи.").max(30000),
  published: z.boolean(),
}).strict();

export const diaryUpdateSchema = diaryEntrySchema.extend({ updatedAt: z.iso.datetime() });
