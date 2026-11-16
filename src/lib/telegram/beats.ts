import sharp from "sharp";
import { getS3Config } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";

type PublishBeatToTelegramInput = {
  title: string;
  slug: string;
  genre: string;
  substyle: string;
  bpm: number;
  mood: string;
  priceRub: number;
  priceUsd: number;
  coverImageUrl: string | null;
  previewUrl: string | null;
};

type TelegramConfig = {
  token: string;
  chatId: string;
};

const TELEGRAM_API_BASE = "https://api.telegram.org";

function getTelegramConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return null;
  }

  return { token, chatId };
}

function normalizeSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://hamloprod.org").replace(/\/$/, "");
}

function buildBeatPublicUrl(slug: string) {
  return `${normalizeSiteUrl()}/ru/beats/${slug}`;
}

function isPublicHttpsUrl(value: string | null) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatCaption(input: PublishBeatToTelegramInput) {
  const beatUrl = buildBeatPublicUrl(input.slug);
  const rub = Number.isFinite(input.priceRub) ? Math.max(0, input.priceRub) : 0;
  const usd = Number.isFinite(input.priceUsd) ? Math.max(0, input.priceUsd) : 0;

  return [
    `Новый бит: ${input.title}`,
    `Жанр: ${input.genre.toUpperCase()} / ${input.substyle}`,
    `Mood: ${input.mood} / ${input.bpm} BPM`,
    `Цена: ${rub} RUB / ${usd} USD`,
    "",
    `Слушать и купить: ${beatUrl}`,
  ].join("\n");
}

export type TelegramPublishDeps = {
  fetch?: typeof fetch;
  config?: TelegramConfig;
  publicBaseUrl?: string;
  downloadUrl?: (url: URL) => Promise<string>;
};

export class TelegramPublishError extends Error {}

async function downloadMedia(url: string, maxBytes: number, deps: TelegramPublishDeps): Promise<Uint8Array<ArrayBuffer>> {
  const base = new URL(deps.publicBaseUrl ?? getS3Config().publicBaseUrl);
  const target = new URL(url);
  if (target.protocol !== "https:" || target.origin !== base.origin || !target.pathname.startsWith(base.pathname.replace(/\/+$/, "") + "/")) {
    throw new TelegramPublishError("Недопустимая ссылка на файл бита.");
  }
  const storageUrl = deps.downloadUrl ? await deps.downloadUrl(target) : (await new ContaboS3Storage(getS3Config()).createSignedDownloadUrl(
    { visibility: "public", key: decodeURIComponent(target.pathname.slice(base.pathname.replace(/\/+$/, "").length + 1)) }, { expiresInSeconds: 300 },
  )).url;
  const response = await (deps.fetch ?? fetch)(storageUrl, { redirect: "error", signal: AbortSignal.timeout(60000) });
  if (!response.ok || !response.body) throw new TelegramPublishError("Не удалось скачать файл бита из хранилища. Попробуй позже.");
  if (Number(response.headers.get("content-length")) > maxBytes) { await response.body.cancel(); throw new TelegramPublishError("Файл слишком большой для Telegram."); }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new TelegramPublishError("Файл слишком большой для Telegram."); }
    chunks.push(value);
  }
  if (!size) throw new TelegramPublishError("Файл бита пустой.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function callTelegramApi(config: TelegramConfig, method: string, body: Record<string, unknown>, deps: TelegramPublishDeps, file?: { field: string; bytes: Uint8Array<ArrayBuffer>; type: string; name: string }) {
  let payloadBody: string | FormData;
  if (file) {
    const form = new FormData();
    for (const [key, value] of Object.entries(body)) form.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    form.set(file.field, new Blob([file.bytes], { type: file.type }), file.name);
    payloadBody = form;
  } else {
    payloadBody = JSON.stringify(body);
  }
  let response: Response;
  try {
    response = await (deps.fetch ?? fetch)(`${TELEGRAM_API_BASE}/bot${config.token}/${method}`, {
      method: "POST", headers: file ? undefined : { "Content-Type": "application/json" }, body: payloadBody,
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    // A timeout can happen after Telegram accepted a message. Never auto-retry.
    throw new TelegramPublishError("Telegram не подтвердил отправку. Проверь канал перед повторной публикацией.");
  }
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !payload?.ok) throw new TelegramPublishError(payload?.description || `Telegram: ошибка ${response.status}`);
}

export async function publishBeatToTelegram(input: PublishBeatToTelegramInput, deps: TelegramPublishDeps = {}) {
  const config = deps.config ?? getTelegramConfig();
  if (!config) return { ok: false as const, reason: "not_configured" as const };
  // Prepare both files before publishing anything. Telegram receives file bytes,
  // rather than having to fetch large PNG/MP3 files from the storage itself.
  const [photo, audio] = await Promise.all([
    input.coverImageUrl ? downloadMedia(input.coverImageUrl, 20 * 1024 * 1024, deps).then(async (bytes) => {
      const jpeg = await sharp(bytes, { limitInputPixels: 40000000 }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).flatten({ background: "#0d0d0d" }).jpeg({ quality: 85 }).toBuffer();
      return new Uint8Array(jpeg);
    }) : null,
    isPublicHttpsUrl(input.previewUrl) ? downloadMedia(input.previewUrl!, 50 * 1024 * 1024, deps) : null,
  ]);
  const caption = formatCaption(input);
  const keyboard = { inline_keyboard: [[{ text: "Купить лицензию", url: "https://t.me/Andrei91S" }, { text: "Открыть бит", url: buildBeatPublicUrl(input.slug) }]] };
  if (photo) {
    await callTelegramApi(config, "sendPhoto", { chat_id: config.chatId, caption, reply_markup: keyboard }, deps,
      { field: "photo", bytes: photo, type: "image/jpeg", name: "cover.jpg" });
  } else {
    await callTelegramApi(config, "sendMessage", { chat_id: config.chatId, text: caption, reply_markup: keyboard, disable_web_page_preview: false }, deps);
  }
  if (audio) {
    try {
      await callTelegramApi(config, "sendAudio", { chat_id: config.chatId, caption: `PREVIEW: ${input.title}`, title: input.title, performer: "HamloProd", disable_notification: true }, deps,
        { field: "audio", bytes: audio, type: "audio/mpeg", name: `${input.slug.replace(/[^a-z0-9_-]/gi, "-")}-preview.mp3` });
    } catch {
      throw new TelegramPublishError("Обложка уже опубликована. Отправка аудио не подтверждена — проверь канал перед повтором.");
    }
  }
  return { ok: true as const };
}
