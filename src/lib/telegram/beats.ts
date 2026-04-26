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
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://hamloprod.com").replace(/\/$/, "");
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

async function callTelegramApi(config: TelegramConfig, method: string, body: Record<string, unknown>) {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${config.token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram ${method} failed with status ${response.status}`);
  }
}

export async function publishBeatToTelegram(input: PublishBeatToTelegramInput) {
  const config = getTelegramConfig();
  if (!config) {
    return { ok: false as const, reason: "not_configured" as const };
  }

  const caption = formatCaption(input);
  const beatUrl = buildBeatPublicUrl(input.slug);
  const keyboard = {
    inline_keyboard: [[{ text: "Купить лицензию", url: "https://t.me/Andrei91S" }, { text: "Открыть бит", url: beatUrl }]],
  };

  if (input.coverImageUrl) {
    await callTelegramApi(config, "sendPhoto", {
      chat_id: config.chatId,
      photo: input.coverImageUrl,
      caption,
      reply_markup: keyboard,
      disable_web_page_preview: false,
    });
  } else {
    await callTelegramApi(config, "sendMessage", {
      chat_id: config.chatId,
      text: caption,
      reply_markup: keyboard,
      disable_web_page_preview: false,
    });
  }

  if (isPublicHttpsUrl(input.previewUrl)) {
    await callTelegramApi(config, "sendAudio", {
      chat_id: config.chatId,
      audio: input.previewUrl,
      caption: `PREVIEW: ${input.title}`,
      title: input.title,
      performer: "HamloProd",
      disable_notification: true,
    });
  }

  return { ok: true as const };
}