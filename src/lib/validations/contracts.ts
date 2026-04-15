import { z } from "zod";

export const contractPreviewRequestSchema = z.object({
  orderId: z.string().uuid("Invalid orderId."),
});

export type ContractPreviewRequest = z.infer<typeof contractPreviewRequestSchema>;
