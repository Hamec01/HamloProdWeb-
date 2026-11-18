import { z } from "zod";

export const optionalBuyerPhone = z.string().trim().max(40).refine((value) => value.length === 0 || value.length >= 7, "Укажите телефон полностью или оставьте поле пустым");
export const licenseProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Укажите имя и фамилию").max(180),
  stageName: z.string().trim().max(120),
  email: z.string().trim().email().max(320),
  country: z.string().trim().min(2, "Укажите страну").max(120),
  city: z.string().trim().min(2, "Укажите город").max(120),
  phone: optionalBuyerPhone,
}).strict();
export type LicenseProfileDetails = z.infer<typeof licenseProfileSchema>;
