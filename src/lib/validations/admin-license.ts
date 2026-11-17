import { z } from "zod";

export const adminLicenseCreateSchema = z.object({
  beatId: z.uuid(),
  buyerUserId: z.uuid().optional(),
  buyerName: z.string().trim().min(2).max(180),
  buyerEmail: z.string().trim().email().max(254),
  buyerCountry: z.string().trim().min(2).max(120),
  buyerCity: z.string().trim().min(2).max(120),
  buyerStageName: z.string().trim().min(1).max(120),
  buyerPhone: z.string().trim().max(60).optional().default(""),
  amount: z.number().int().min(1).max(100_000_000),
  currency: z.enum(["RUB", "USD"]),
  contractLanguage: z.enum(["ru", "en"]),
  buyerAcceptedTerms: z.literal(true),
  buyerConsentedToData: z.literal(true),
}).strict();

export type AdminLicenseCreateInput = z.infer<typeof adminLicenseCreateSchema>;
