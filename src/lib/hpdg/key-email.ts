/**
 * License-key email (English first, Russian below) and sending through the Resend
 * REST API. No SDK; `fetch` is injectable for tests. The key is the only secret in
 * the message — no installer link (the download page asks for the key).
 */

export const DOWNLOAD_PAGE = "https://hamloprod.org/hpdg/download";

export type KeyEmail = { subject: string; text: string; html: string };

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildKeyEmail(input: { key: string }): KeyEmail {
  const key = input.key;
  const text = [
    "Thanks for buying HPDG!",
    "",
    `Your license key: ${key}`,
    "",
    `1. Download HPDG: ${DOWNLOAD_PAGE}?lang=en (enter the key there).`,
    "2. Run the installer (Windows 10/11 x64, VST3). Close your DAW first.",
    "3. Open HPDG in your DAW, click Update in the header and enter the same key once.",
    "   From then on new versions arrive right in the plugin.",
    "",
    "Keep this email: the key is your access to downloads and updates.",
    "",
    "—",
    "",
    "Спасибо за покупку HPDG!",
    "",
    `Твой ключ лицензии: ${key}`,
    "",
    `1. Скачай HPDG: ${DOWNLOAD_PAGE}?lang=ru (там введи ключ).`,
    "2. Запусти установщик (Windows 10/11 x64, VST3). DAW перед этим закрой.",
    "3. Открой HPDG в DAW, нажми Update в шапке и введи тот же ключ один раз.",
    "   Дальше новые версии приходят прямо в плагин.",
    "",
    "Сохрани это письмо: ключ — твой доступ к скачиванию и обновлениям.",
    "",
    "HamloProd · https://hamloprod.org",
  ].join("\n");

  const k = escapeHtml(key);
  const block = (lang: "en" | "ru") => {
    const en = lang === "en";
    return `
      <p style="margin:0 0 16px">${en ? "Thanks for buying HPDG!" : "Спасибо за покупку HPDG!"}</p>
      <p style="margin:0 0 6px;color:#666;font-size:13px">${en ? "Your license key" : "Твой ключ лицензии"}</p>
      <p style="margin:0 0 20px;font-family:Consolas,Menlo,monospace;font-size:22px;letter-spacing:1px;font-weight:bold">${k}</p>
      <ol style="margin:0 0 16px;padding-left:20px;line-height:1.6">
        <li>${en ? "Download HPDG" : "Скачай HPDG"}: <a href="${DOWNLOAD_PAGE}?lang=${lang}">${DOWNLOAD_PAGE.replace("https://", "")}</a> ${en ? "(enter the key there)." : "(там введи ключ)."}</li>
        <li>${en ? "Run the installer (Windows 10/11 x64, VST3). Close your DAW first." : "Запусти установщик (Windows 10/11 x64, VST3). DAW перед этим закрой."}</li>
        <li>${en ? "Open HPDG in your DAW, click <b>Update</b> in the header and enter the same key once. From then on new versions arrive right in the plugin." : "Открой HPDG в DAW, нажми <b>Update</b> в шапке и введи тот же ключ один раз. Дальше новые версии приходят прямо в плагин."}</li>
      </ol>
      <p style="margin:0;color:#666;font-size:13px">${en ? "Keep this email: the key is your access to downloads and updates." : "Сохрани это письмо: ключ — твой доступ к скачиванию и обновлениям."}</p>`;
  };
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:28px;border-radius:8px">
    ${block("en")}
    <hr style="border:0;border-top:1px solid #ddd;margin:28px 0">
    ${block("ru")}
    <p style="margin:28px 0 0;color:#999;font-size:12px">HamloProd · <a href="https://hamloprod.org" style="color:#999">hamloprod.org</a></p>
  </div></body></html>`;

  return { subject: "Your HPDG license key / Твой ключ HPDG", text, html };
}

export type MailConfig = { apiKey: string; from: string; replyTo?: string | null };

export class MailNotConfiguredError extends Error {
  constructor() {
    super("RESEND_API_KEY is not set.");
    this.name = "MailNotConfiguredError";
  }
}

export function getMailConfig(env: Record<string, string | undefined> = process.env): MailConfig {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new MailNotConfiguredError();
  return {
    apiKey,
    from: env.HPDG_MAIL_FROM?.trim() || "HamloProd <hello@hamloprod.org>",
    replyTo: env.HPDG_MAIL_REPLY_TO?.trim() || null,
  };
}

/** Resend `POST /emails`. `idempotencyKey` stops a retried webhook from sending twice. */
export async function sendEmail(
  to: string,
  mail: KeyEmail,
  config: MailConfig,
  options: { idempotencyKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ id: string | null }> {
  const response = await (options.fetchImpl ?? fetch)("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    }),
  });
  const data = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!response.ok) throw new Error(`Resend ${response.status}: ${data?.message ?? "send failed"}`);
  return { id: data?.id ?? null };
}
