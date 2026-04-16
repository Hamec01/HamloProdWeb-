import { z } from "zod";

export const rightsFormModeSchema = z.enum(["deferred", "filled-now"]);

export const contractPdfCreateSchema = z.object({
  orderId: z.uuid(),
  mode: rightsFormModeSchema,
  buyerFullName: z.string().trim().max(180).optional(),
  buyerCity: z.string().trim().max(120).optional(),
  buyerStageName: z.string().trim().max(120).optional(),
});

export type RightsFormMode = z.infer<typeof rightsFormModeSchema>;
export type ContractPdfCreatePayload = z.infer<typeof contractPdfCreateSchema>;
