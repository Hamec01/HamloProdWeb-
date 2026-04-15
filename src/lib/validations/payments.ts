import { z } from "zod";

export const paymentCreateRequestSchema = z.object({
  orderId: z.string().uuid("Invalid orderId."),
});

export type PaymentCreateRequest = z.infer<typeof paymentCreateRequestSchema>;