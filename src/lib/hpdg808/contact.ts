import { z } from "zod";

export const hpdg808DownloadSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.string().email().or(z.literal(""))).optional(),
  locale: z.enum(["en", "ru"]).default("en"),
});
