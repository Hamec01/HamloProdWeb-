import type { Locale } from "@/lib/i18n";

/**
 * Shown wherever a paid-checkout entry point used to be, while
 * `PAID_CHECKOUT_ENABLED` is off. No active link into `/checkout` — only the
 * status message and an optional Telegram contact.
 */
export function PaymentsDisabledNotice({
  locale,
  className = "",
}: {
  locale: Locale;
  className?: string;
}) {
  const copy =
    locale === "ru"
      ? {
          title: "Онлайн-оплата временно недоступна",
          body: "Покупка лицензий онлайн отключена, пока подключается платёжная система. Каталог, прослушивание, регистрация и профиль работают как обычно.",
          contact: "Написать в Telegram",
        }
      : {
          title: "Online payments are temporarily unavailable",
          body: "Online license purchases are turned off while a payment provider is being connected. The catalogue, playback, sign-up and profile work as usual.",
          contact: "Message on Telegram",
        };

  return (
    <div
      className={`rounded-2xl border border-[rgba(185,149,90,0.35)] bg-[rgba(185,149,90,0.08)] p-6 ${className}`}
      role="status"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-paper-100)]">{copy.title}</p>
      <p className="mt-3 text-sm leading-7 text-[var(--color-paper-200)]">{copy.body}</p>
      <a
        href="https://t.me/Andrei91S"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
      >
        {copy.contact}
      </a>
    </div>
  );
}
