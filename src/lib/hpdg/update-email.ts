import { z } from "zod";
import beta7 from "./beta7-email.json";
import type { KeyEmail, MailConfig } from "./key-email";

export const campaignInputSchema = z.object({
  releaseId: z.string().uuid(),
  subject: z.string().trim().min(1).max(200).refine((s) => !/[\r\n]/.test(s)),
  text: z.string().trim().min(20).max(12000),
});

export function defaultUpdateEmail(release: { version: string; title: string; notes: string; page: string }) {
  if (release.version === "0.1.0-beta.7") return beta7;
  return {
    subject: `${release.title} is available`,
    text: `Hi!\n\nThank you for supporting HPDG! ${release.title} is available.\n\n${release.notes}\n\nSave your project and a backup. Press Update in HPDG and enter the key from your purchase email if prompted. Wait for the download and verification, confirm the installer launch, then close your DAW before files are replaced. After installing, restart the DAW and check the version.\n\nManual download: https://hamloprod.org/hpdg/download\nRelease page: ${release.page}\n\nThe key is for downloads and updates; making music needs no activation or constant internet connection.\n\nQuestions and feedback: hello@hamloprod.org. Never share your license key publicly.\n\nThank you!\nHamloProd`,
  };
}

/** Plain text is the source of truth. Escape everything before making HTML. */
export function buildUpdateEmail(input: { subject: string; text: string }): KeyEmail {
  const escaped = input.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const linked = escaped.replace(/https:\/\/hamloprod\.org\/[^\s<]*/g, (url) => `<a href="${url}">${url}</a>`);
  return { ...input, html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;line-height:1.6;white-space:pre-wrap">${linked}</div>` };
}

export function eligibleBuyer(key: { source: string; stripePaymentId: string | null; revokedAt: Date | string | null }) {
  return !key.revokedAt && Boolean(key.stripePaymentId) && ["stripe", "stripe-csv"].includes(key.source);
}

export function deliveryState(event: string): string {
  if (["delivered", "opened", "clicked"].includes(event)) return "delivered";
  if (["bounced", "complained", "failed", "suppressed", "canceled"].includes(event)) return event;
  return "accepted";
}

export class UpdateSendError extends Error {
  constructor(public readonly uncertain: boolean) {
    super(uncertain ? "Результат отправки неизвестен. Проверь Resend; автоматический повтор отключён, чтобы избежать дубля." : "Resend отклонил запрос. Проверь настройки почты и повтори отправку.");
  }
}

/** Require a provider ID. Ambiguous responses must never turn into a blind retry. */
export async function sendUpdateEmail(
  email: string,
  mail: KeyEmail,
  config: MailConfig,
  idempotencyKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ from: config.from, to: [email], ...mail, ...(config.replyTo ? { reply_to: config.replyTo } : {}) }),
    });
  } catch { throw new UpdateSendError(true); }
  if (!response.ok) throw new UpdateSendError(response.status >= 500 || response.status === 408 || response.status === 409);
  const data = await response.json().catch(() => null) as { id?: string } | null;
  if (!data?.id) throw new UpdateSendError(true);
  return data.id;
}

export async function retrieveDelivery(id: string, apiKey: string): Promise<string> {
  const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10000), cache: "no-store",
  });
  if (!response.ok) throw new Error("Не удалось получить статус из Resend. Проверь доступ API-ключа к чтению писем.");
  const data = await response.json() as { last_event?: string };
  if (!data.last_event) throw new Error("Resend ещё не вернул статус доставки.");
  return deliveryState(data.last_event);
}
