"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  orderId: string;
  locale: "ru" | "en";
  autoStart: boolean;
};

type PaymentResponse = {
  payment_url?: string | null;
  paymentUrl?: string | null;
  status?: string;
  kind?: "free" | "paid";
  error?: string;
};

async function requestPaymentCreation(orderId: string) {
  const response = await fetch("/api/payments/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });

  const payload = (await response.json().catch(() => null)) as PaymentResponse | null;

  return {
    ok: response.ok,
    payload,
  };
}

const copy = {
  ru: {
    idle: "Готовим безопасное создание платежа на сервере.",
    loading: "Создаём платёж...",
    cta: "Создать платёж",
    retry: "Повторить",
    zeroAmount: "Бит получен за 100 поинтов. Лицензия доступна в вашем профиле.",
    missingUrl: "Платёж создан, но URL для редиректа не получен. Проверьте конфигурацию платёжного провайдера и ответ API.",
    fallbackError: "Не удалось подготовить оплату. Проверьте состояние заказа и конфигурацию платёжного провайдера.",
  },
  en: {
    idle: "Preparing a safe server-side payment creation step.",
    loading: "Creating payment...",
    cta: "Create Payment",
    retry: "Retry",
    zeroAmount: "Your beat was redeemed for 100 points. The license is available in your profile.",
    missingUrl: "Payment was prepared, but no redirect URL was returned. Check the payment provider configuration and API response.",
    fallbackError: "Failed to prepare payment. Check the order state and payment provider configuration.",
  },
};

export function PaymentCreatePanel({ orderId, locale, autoStart }: Props) {
  const t = copy[locale];
  const attemptedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(t.idle);
  const [error, setError] = useState<string | null>(null);

  async function runCreatePayment() {
    setIsLoading(true);
    setError(null);
    setMessage(t.loading);

    try {
      const { ok, payload } = await requestPaymentCreation(orderId);
      if (!ok) {
        setError(payload?.error ?? t.fallbackError);
        setMessage(t.idle);
        return;
      }

      if (payload?.kind === "free") {
        setMessage(t.zeroAmount);
        return;
      }

      const paymentUrl = payload?.payment_url ?? payload?.paymentUrl;

      if (paymentUrl) {
        window.location.assign(paymentUrl);
        return;
      }

      setError(t.missingUrl);
      setMessage(t.idle);
    } catch {
      setError(t.fallbackError);
      setMessage(t.idle);
    } finally {
      setIsLoading(false);
    }
  }

  const autoStartPayment = useEffectEvent(() => {
    void runCreatePayment();
  });

  useEffect(() => {
    if (!autoStart || attemptedRef.current) {
      return;
    }

    attemptedRef.current = true;
    autoStartPayment();
  }, [autoStart]);

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
      <p className="text-sm leading-7 text-[var(--color-paper-200)]">{message}</p>

      {error ? (
        <p className="rounded border border-red-500/30 bg-red-900/20 px-4 py-2 text-sm text-red-300">{error}</p>
      ) : null}

      <Button type="button" onClick={() => void runCreatePayment()} disabled={isLoading}>
        {isLoading ? t.loading : error ? t.retry : t.cta}
      </Button>
    </div>
  );
}