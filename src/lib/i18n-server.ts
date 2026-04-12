import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return value === "en" ? "en" : "ru";
}
