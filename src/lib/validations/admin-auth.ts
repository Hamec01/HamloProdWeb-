import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.email("Укажи корректный email"),
  // Login validates credentials already stored in the database. The stronger
  // minimum belongs to password creation/reset and must not lock out an
  // existing account with a shorter legacy password.
  password: z.string().min(1, "Введи пароль").max(128, "Максимум 128 символов"),
});

export type AdminLoginValues = z.infer<typeof adminLoginSchema>;
