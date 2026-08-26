const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  // Uppercase Cyrillic
  А: "a",
  Б: "b",
  В: "v",
  Г: "g",
  Д: "d",
  Е: "e",
  Ё: "yo",
  Ж: "zh",
  З: "z",
  И: "i",
  Й: "y",
  К: "k",
  Л: "l",
  М: "m",
  Н: "n",
  О: "o",
  П: "p",
  Р: "r",
  С: "s",
  Т: "t",
  У: "u",
  Ф: "f",
  Х: "kh",
  Ц: "ts",
  Ч: "ch",
  Ш: "sh",
  Щ: "shch",
  Ъ: "",
  Ы: "y",
  Ь: "",
  Э: "e",
  Ю: "yu",
  Я: "ya",
  // Extended Cyrillic
  є: "ye",
  Є: "ye",
  і: "i",
  І: "i",
  ї: "yi",
  Ї: "yi",
  ґ: "g",
  Ґ: "g",
  ў: "u",
  Ў: "u",
};

/**
 * Transliterates Cyrillic characters to Latin equivalents.
 */
export function transliterateCyrillic(text: string): string {
  return text
    .split("")
    .map((char) => (CYRILLIC_TO_LATIN_MAP[char] !== undefined ? CYRILLIC_TO_LATIN_MAP[char] : char))
    .join("");
}

/**
 * Generates a clean URL-friendly slug from any string,
 * automatically transliterating Cyrillic characters to Latin.
 */
export function generateSlug(text: string): string {
  if (!text) return "";
  const transliterated = transliterateCyrillic(text.trim());
  return transliterated
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s-_]/g, "") // Remove special characters
    .trim()
    .replace(/[\s_]+/g, "-") // Replace spaces/underscores with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ""); // Trim hyphens
}

/**
 * Automatically computes the next sequential Case Number based on existing beats.
 * E.g., if existing are "CASE-001" through "CASE-006", returns "CASE-007".
 */
export function getNextCaseNumber(beats: Array<{ caseNumber?: string; case_number?: string }>): string {
  let maxNumber = 0;

  for (const item of beats) {
    const raw = item.caseNumber || item.case_number || "";
    const match = raw.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextNumber = maxNumber + 1;
  return `CASE-${String(nextNumber).padStart(3, "0")}`;
}
