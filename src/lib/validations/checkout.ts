import { z } from "zod";
import { optionalBuyerPhone } from "@/lib/account/license-profile";

export const checkoutFormSchema = z.object({
  payment_method: z.enum(["stripe", "contact"]).optional(),
  beat_id: z.string().uuid(),
  buyer_name: z.string().trim().min(2, "Введите полное имя").max(180),
  buyer_stage_name: z.string().trim().max(120).optional(),
  buyer_email: z.string().trim().email("Некорректный email").max(320),
  buyer_country: z.string().trim().min(2, "Укажите страну").max(120),
  buyer_city: z.string().trim().min(2, "Укажите город").max(120),
  buyer_phone: optionalBuyerPhone,
  save_profile: z.boolean().optional(),
  license_type: z.literal("exclusive"),
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
