"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";

type LoyaltyStatus = {
  points: number;
  discountPercent: number;
  nextThreshold: number | null;
};

export function LoyaltyPurchasePanel({
  beatId,
  basePriceUsd,
  isAuthenticated,
  locale,
}: {
  beatId: string;
  basePriceUsd: number;
  isAuthenticated: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<LoyaltyStatus>({ points: 0, discountPercent: 0, nextThreshold: 100 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const copy = useMemo(
    () =>
      locale === "ru"
        ? {
            heading: "Loyalty points",
            pointsLabel: "Твои поинты",
            discountLabel: "Скидка сейчас",
            nextLabel: "Следующая скидка",
            loginHint: "Поинты доступны после входа.",
            buyAction: "Открыть заявку",
            buying: "Обработка",
            success: "Заявка открыта. Поинты начисляются после подтверждения оплаты.",
            failed: "Не удалось оформить покупку.",
            threshold2: "25 поинтов за оплаченную покупку",
            threshold4: "100 поинтов = один бесплатный бит",
            finalPrice: "Цена с учётом скидки",
          }
        : {
            heading: "Loyalty points",
            pointsLabel: "Your points",
            discountLabel: "Current discount",
            nextLabel: "Next discount",
            loginHint: "Points and discounts are available after login.",
            buyAction: "Open request",
            buying: "Processing",
            success: "Request opened. Points are awarded after payment confirmation.",
            failed: "Failed to complete purchase.",
            threshold2: "25 points per paid purchase",
            threshold4: "100 points = one free beat",
            finalPrice: "Discounted price",
          },
    [locale],
  );

  const loadStatus = async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/loyalty/status", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as LoyaltyStatus | null;
      if (response.ok && payload) {
        setStatus(payload);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, [isAuthenticated]);

  const discountedPrice = Math.max(0, Math.round((basePriceUsd * (100 - status.discountPercent)) / 100));

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      router.push(`/auth?next=/beats`);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/beats/${beatId}/inquiry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reserve: false }) });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            url?: string;
            pointsAfter?: number;
            discountPercent?: number;
            finalPriceUsd?: number;
          }
        | null;

      if (!response.ok) {
        setMessage(payload?.error ?? copy.failed);
        return;
      }

      if (payload?.url) router.push(payload.url);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-5 space-y-3 border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-paper-400)]">{copy.heading}</p>

      {isAuthenticated ? (
        <>
          <div className="grid gap-2 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-200)] sm:grid-cols-2">
            <p>
              {copy.pointsLabel}: <span className="text-[var(--color-paper-100)]">{isLoading ? "..." : status.points}</span>
            </p>
            <p>
              {copy.discountLabel}: <span className="text-[var(--color-paper-100)]">{isLoading ? "..." : `${status.discountPercent}%`}</span>
            </p>
          </div>

          <div className="grid gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--color-paper-400)] sm:grid-cols-2">
            <p>{copy.threshold2}</p>
            <p>{copy.threshold4}</p>
          </div>

          <p className="text-sm text-[var(--color-paper-200)]">
            {copy.finalPrice}: <span className="font-sans text-3xl tracking-[0.04em] text-[var(--color-paper-100)]">${discountedPrice}</span>
          </p>

          <Button type="button" variant="ghost" onClick={() => void handlePurchase()} disabled={isSubmitting || isLoading}>
            {isSubmitting ? copy.buying : copy.buyAction}
          </Button>
        </>
      ) : (
        <p className="text-sm text-[var(--color-paper-400)]">{copy.loginHint}</p>
      )}

      {message ? <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-paper-400)]">{message}</p> : null}
    </div>
  );
}
