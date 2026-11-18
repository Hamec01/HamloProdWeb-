import { z } from "zod";
export const messageInput = z.object({ text: z.string().trim().min(1).max(4000), clientMessageId: z.uuid() }).strict();
export const noteInput = z.object({ text: z.string().trim().min(1).max(4000), requestId: z.uuid() }).strict();
export const grantInput = z.object({ amount: z.number().int().min(1).max(10000), reason: z.string().trim().min(1).max(500), requestId: z.uuid() }).strict();
