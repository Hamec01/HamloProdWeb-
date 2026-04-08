import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.email("Укажи корректный email"),
  password: z.string().min(8, "Минимум 8 символов"),
});

export type AdminLoginValues = z.infer<typeof adminLoginSchema>;