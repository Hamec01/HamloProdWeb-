import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.email("Укажи корректный email"),
  password: z.string().min(12, "Минимум 12 символов").max(128, "Максимум 128 символов"),
});

export type AdminLoginValues = z.infer<typeof adminLoginSchema>;
