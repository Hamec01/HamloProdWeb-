import { z } from "zod";

export const orderDeliverySchema = z.object({
  url: z.string().trim().max(4000).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch { return false; }
  }, "Укажите HTTPS-ссылку на MP3 или страницу скачивания."),
}).strict();
