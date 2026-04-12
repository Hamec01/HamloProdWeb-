import { cache } from "react";
import type { Locale } from "@/lib/i18n";

const CYRILLIC_RE = /[А-Яа-яЁё]/;

const translateRuToEnCached = cache(async (text: string) => {
  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=en&dt=t&q=${encodeURIComponent(text)}`,
    { next: { revalidate: 60 * 60 * 24 } },
  );

  if (!response.ok) {
    throw new Error("Translation request failed");
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    throw new Error("Unexpected translation response");
  }

  const fragments = payload[0] as Array<Array<unknown>>;
  const translated = fragments.map((part) => (typeof part?.[0] === "string" ? part[0] : "")).join("").trim();

  return translated || text;
});

export async function maybeAutoTranslate(text: string, locale: Locale): Promise<string> {
  if (locale !== "en") {
    return text;
  }

  if (!CYRILLIC_RE.test(text)) {
    return text;
  }

  try {
    return await translateRuToEnCached(text);
  } catch {
    return text;
  }
}
