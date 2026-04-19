import { z } from "zod";

export const checkoutFormSchema = z.object({
  beat_id: z.string().uuid(),
  buyer_name: z.string().trim().min(2, "Введите полное имя"),
  buyer_email: z.string().trim().email("Некорректный email"),
  buyer_country: z.string().trim().min(2, "Укажите страну"),
  buyer_city: z.string().trim().min(2, "Укажите город"),
  buyer_phone: z.string().trim().min(7, "Укажите телефон"),
  license_type: z.enum(["basic", "exclusive"]),
  contract_language: z.enum(["ru", "en"]),
  use_loyalty_points: z.boolean().optional(),
  acceptance: z.literal(true, {
    message: "Необходимо принять условия лицензии",
  }),
  personal_data: z.literal(true, {
    message: "Необходимо дать согласие на обработку данных",
  }),
});

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
