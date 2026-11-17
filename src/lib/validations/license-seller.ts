import { z } from "zod";

export const licenseSellerSchema = z.object({
  seller_name: z.string().trim().min(2).max(180),
  seller_country: z.string().trim().min(2).max(120),
  seller_city: z.string().trim().min(2).max(120),
  seller_email: z.string().trim().email().max(254),
  seller_telegram: z.string().trim().max(180),
  seller_passport: z.string().trim().max(180),
  seller_alias: z.string().trim().min(1).max(120),
  seller_phone: z.string().trim().max(60),
  seller_address: z.string().trim().max(300),
  seller_payment_requisites: z.string().trim().max(1000),
  seller_signature_image: z.string().max(700_000).regex(/^$|^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/),
}).strict();

export type LicenseSellerInput = z.infer<typeof licenseSellerSchema>;
