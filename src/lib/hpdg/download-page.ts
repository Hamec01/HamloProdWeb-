/** Texts and API-status mapping for the buyer download page (/hpdg/download). Pure, browser-safe. */

export type DownloadLocale = "ru" | "en";

export const downloadCopy = {
  en: {
    eyebrow: "HPDG / buyers",
    title: "Download HPDG",
    intro: "Enter the license key from your purchase email. The current version downloads right away.",
    current: "Current version",
    none: "No version is available yet.",
    keyLabel: "License key",
    submit: "Download",
    working: "Checking the key…",
    started: "Download started:",
    manual: "If it did not start, click here",
    linkExpires: "The link works for 10 minutes. Up to 5 downloads per day per key.",
    stepsTitle: "After downloading",
    steps: [
      "Run the installer (Windows 10/11 x64; administrator rights are needed). Close your DAW first.",
      "Open HPDG in your DAW and click Update in the header. Enter the same key once.",
      "From then on, new versions arrive in the plugin: click Update and HPDG installs them itself.",
    ],
    noKey: "No key yet?",
    buy: "Get HPDG",
    errors: {
      invalid: "This key is not valid. Check it in your purchase email (format HPDG-XXXX-XXXX-XXXX-XXXX).",
      revoked: "This key is no longer active. Contact us if you think this is a mistake.",
      limit: "Too many attempts for today. Try again tomorrow or contact us.",
      noRelease: "No version is available to download yet.",
      other: "hamloprod.org did not answer. Try again in a minute.",
    },
  },
  ru: {
    eyebrow: "HPDG / для покупателей",
    title: "Скачать HPDG",
    intro: "Введи ключ лицензии из письма о покупке. Текущая версия скачается сразу.",
    current: "Текущая версия",
    none: "Версия для скачивания пока не выложена.",
    keyLabel: "Ключ лицензии",
    submit: "Скачать",
    working: "Проверяю ключ…",
    started: "Скачивание началось:",
    manual: "Если не началось, нажми сюда",
    linkExpires: "Ссылка действует 10 минут. До 5 скачиваний в сутки на один ключ.",
    stepsTitle: "После скачивания",
    steps: [
      "Запусти установщик (Windows 10/11 x64, нужны права администратора). DAW перед этим закрой.",
      "Открой HPDG в DAW и нажми Update в шапке плагина. Введи тот же ключ один раз.",
      "Дальше новые версии приходят прямо в плагин: нажимаешь Update, и HPDG ставит их сам.",
    ],
    noKey: "Ещё нет ключа?",
    buy: "Купить HPDG",
    errors: {
      invalid: "Ключ не подходит. Проверь его в письме о покупке (формат HPDG-XXXX-XXXX-XXXX-XXXX).",
      revoked: "Этот ключ больше не действует. Напиши нам, если это ошибка.",
      limit: "Слишком много попыток за сегодня. Попробуй завтра или напиши нам.",
      noRelease: "Версия для скачивания пока не выложена.",
      other: "hamloprod.org не ответил. Попробуй через минуту.",
    },
  },
} as const;

export function downloadErrorMessage(status: number, locale: DownloadLocale): string {
  const errors = downloadCopy[locale].errors;
  if (status === 401) return errors.invalid;
  if (status === 403) return errors.revoked;
  if (status === 429) return errors.limit;
  if (status === 404) return errors.noRelease;
  return errors.other;
}

/** `?lang=` from an email link wins over the site cookie. */
export function pickDownloadLocale(lang: unknown, cookieLocale: DownloadLocale): DownloadLocale {
  return lang === "ru" || lang === "en" ? lang : cookieLocale;
}

/** The page only follows installer links the plugin would accept. */
export function isInstallerUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const path = url.pathname;
    return url.protocol === "https:" && url.hostname === "usc1.contabostorage.com" && /^\/hamloprod-private\/hpdg\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(path);
  } catch {
    return false;
  }
}
