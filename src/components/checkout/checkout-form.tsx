"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkoutFormSchema, type CheckoutFormValues } from "@/lib/validations/checkout";

type Props = {
  beatId: string;
  beatTitle: string;
  beatCaseNumber: string;
  basePriceUsd: number;
  discountPercent: number;
  finalPriceUsd: number;
  currency: "USD" | "RUB";
  prefillEmail: string;
  locale: "ru" | "en";
};

const copy = {
  ru: {
    orderSummary: "Заказ",
    base: "Базовая цена",
    discount: "Скидка (лояльность)",
    final: "Итого к оплате",
    personal: "Персональные данные",
    buyerName: "Полное имя / ФИО",
    buyerEmail: "Email",
    buyerCountry: "Страна",
    buyerCity: "Город",
    buyerPhone: "Телефон",
    licenseType: "Тип лицензии",
    licenseBasic: "Базовая",
    licenseExclusive: "Эксклюзивная",
    contractLang: "Язык договора",
    langRu: "Русский",
    langEn: "English",
    acceptLabel: "Я принимаю условия лицензионного соглашения",
    personalDataLabel: "Я даю согласие на обработку персональных данных",
    submit: "Оформить заказ",
    generatingPreview: "Формируем договор...",
    genericError: "Ошибка при создании договора. Попробуйте ещё раз.",
    free: "Бесплатно",
  },
  en: {
    orderSummary: "Order Summary",
    base: "Base price",
    discount: "Discount (loyalty)",
    final: "Total due",
    personal: "Personal Details",
    buyerName: "Full Name",
    buyerEmail: "Email",
    buyerCountry: "Country",
    buyerCity: "City",
    buyerPhone: "Phone",
    licenseType: "License Type",
    licenseBasic: "Basic",
    licenseExclusive: "Exclusive",
    contractLang: "Contract Language",
    langRu: "Russian",
    langEn: "English",
    acceptLabel: "I accept the license agreement terms",
    personalDataLabel: "I consent to the processing of my personal data",
    submit: "Place Order",
    generatingPreview: "Generating contract...",
    genericError: "Failed to create contract preview. Please try again.",
    free: "Free",
  },
};

function fieldClass(hasError: boolean) {
  return [
    "w-full border px-3 py-2 text-sm bg-[rgba(10,10,10,0.6)] text-[var(--color-paper-100)]",
    "placeholder:text-[var(--color-paper-400)] focus:outline-none focus:ring-1",
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-[var(--color-line)] focus:ring-[var(--color-paper-400)]",
  ].join(" ");
}

function labelClass() {
  return "block text-[10px] uppercase tracking-[0.24em] text-[var(--color-paper-400)] mb-1";
}

function formatUsd(value: number, locale: "ru" | "en", currency: "USD" | "RUB") {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CheckoutForm({
  beatId,
  beatTitle,
  beatCaseNumber,
  basePriceUsd,
  discountPercent,
  finalPriceUsd,
  currency,
  prefillEmail,
  locale,
}: Props) {
  const t = copy[locale];
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      beat_id: beatId,
      buyer_email: prefillEmail,
      license_type: "basic",
      contract_language: locale,
    },
  });

  const onSubmit = async (values: CheckoutFormValues) => {
    setServerError(null);

    try {
      const orderRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const orderPayload = (await orderRes.json().catch(() => null)) as { orderId?: string; error?: string } | null;
      if (!orderRes.ok || !orderPayload?.orderId) {
        setServerError(orderPayload?.error ?? t.genericError);
        return;
      }

      const previewRes = await fetch("/api/contracts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderPayload.orderId }),
      });

      const previewPayload = (await previewRes.json().catch(() => null)) as { previewUrl?: string; error?: string } | null;
      if (!previewRes.ok || !previewPayload?.previewUrl) {
        setServerError(previewPayload?.error ?? t.genericError);
        return;
      }

      router.push(previewPayload.previewUrl);
      router.refresh();
    } catch {
      setServerError(t.genericError);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <input type="hidden" {...register("beat_id")} />

      <section className="rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-300)]">{t.orderSummary}</p>
        <p className="mt-3 text-2xl uppercase tracking-[0.06em] text-[var(--color-paper-100)]">
          CASE #{beatCaseNumber} - {beatTitle}
        </p>
        <div className="mt-4 space-y-2 text-sm text-[var(--color-paper-300)]">
          <div className="flex justify-between">
            <span className="uppercase tracking-[0.12em]">{t.base}</span>
            <span>{formatUsd(basePriceUsd, locale, currency)}</span>
          </div>
          {discountPercent > 0 && (
            <div className="flex justify-between text-amber-400">
              <span className="uppercase tracking-[0.12em]">{t.discount}</span>
              <span>-{discountPercent}%</span>
            </div>
          )}
          <div className="flex justify-between border-t border-[var(--color-line)] pt-2 text-[var(--color-paper-100)]">
            <span className="uppercase tracking-[0.12em]">{t.final}</span>
            <span className="font-semibold">{finalPriceUsd === 0 ? t.free : formatUsd(finalPriceUsd, locale, currency)}</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
        <p className="mb-4 text-xs uppercase tracking-[0.28em] text-[var(--color-paper-300)]">{t.personal}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass()}>{t.buyerName}</label>
            <input {...register("buyer_name")} className={fieldClass(!!errors.buyer_name)} placeholder="-" />
            {errors.buyer_name && <p className="mt-1 text-xs text-red-400">{errors.buyer_name.message}</p>}
          </div>

          <div>
            <label className={labelClass()}>{t.buyerEmail}</label>
            <input {...register("buyer_email")} type="email" className={fieldClass(!!errors.buyer_email)} placeholder="-" />
            {errors.buyer_email && <p className="mt-1 text-xs text-red-400">{errors.buyer_email.message}</p>}
          </div>

          <div>
            <label className={labelClass()}>{t.buyerCountry}</label>
            <input {...register("buyer_country")} className={fieldClass(!!errors.buyer_country)} placeholder="-" />
            {errors.buyer_country && <p className="mt-1 text-xs text-red-400">{errors.buyer_country.message}</p>}
          </div>

          <div>
            <label className={labelClass()}>{t.buyerCity}</label>
            <input {...register("buyer_city")} className={fieldClass(!!errors.buyer_city)} placeholder="-" />
            {errors.buyer_city && <p className="mt-1 text-xs text-red-400">{errors.buyer_city.message}</p>}
          </div>

          <div>
            <label className={labelClass()}>{t.buyerPhone}</label>
            <input {...register("buyer_phone")} type="tel" className={fieldClass(!!errors.buyer_phone)} placeholder="-" />
            {errors.buyer_phone && <p className="mt-1 text-xs text-red-400">{errors.buyer_phone.message}</p>}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass()}>{t.licenseType}</label>
            <select {...register("license_type")} className={fieldClass(!!errors.license_type)}>
              <option value="basic">{t.licenseBasic}</option>
              <option value="exclusive">{t.licenseExclusive}</option>
            </select>
          </div>

          <div>
            <label className={labelClass()}>{t.contractLang}</label>
            <select {...register("contract_language")} className={fieldClass(!!errors.contract_language)}>
              <option value="ru">{t.langRu}</option>
              <option value="en">{t.langEn}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            {...register("acceptance")}
            className="mt-0.5 h-4 w-4 accent-[var(--color-paper-200)]"
          />
          <span className="text-sm leading-5 text-[var(--color-paper-200)]">{t.acceptLabel}</span>
        </label>
        {errors.acceptance && <p className="text-xs text-red-400">{errors.acceptance.message}</p>}

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            {...register("personal_data")}
            className="mt-0.5 h-4 w-4 accent-[var(--color-paper-200)]"
          />
          <span className="text-sm leading-5 text-[var(--color-paper-200)]">{t.personalDataLabel}</span>
        </label>
        {errors.personal_data && <p className="text-xs text-red-400">{errors.personal_data.message}</p>}
      </section>

      {serverError && (
        <p className="rounded border border-red-500/30 bg-red-900/20 px-4 py-2 text-sm text-red-400">{serverError}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full border border-[var(--color-line)] py-3 text-sm uppercase tracking-[0.22em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-50"
      >
        {isSubmitting ? t.generatingPreview : t.submit}
      </button>
    </form>
  );
}
