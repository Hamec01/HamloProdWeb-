"use client";

import { RegisteredBuyerPicker, type RegisteredBuyer } from "@/components/admin/registered-buyer-picker";
import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import type { AdminBeat } from "@/types/beat";

type ManualSale = {
  id: string;
  beatTitle: string;
  buyerName: string;
  buyerEmail: string;
  amount: number;
  currency: "RUB" | "USD";
  createdAt: string;
  hasPdf: boolean;
  provider?: string;
  newMessage?: boolean;
};

type Props = {
  beats: AdminBeat[];
  sales: ManualSale[];
  canCreateSales: boolean;
};

const fieldClass = "w-full border border-[var(--color-line)] bg-[rgba(0,0,0,0.24)] px-3 py-2 text-sm text-[var(--color-paper-100)] outline-none";
const labelClass = "space-y-2 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)]";

export function AdminLicenseManager({ beats, sales, canCreateSales }: Props) {
  const router = useRouter();
  const beatSearchId = useId();
  const [beatQuery, setBeatQuery] = useState("");
  const [selectedBeatId, setSelectedBeatId] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState<RegisteredBuyer | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");
  const availableBeats = beats.filter((beat) => beat.status === "available" || (beat.status === "reserved" && !beat.reservationExpiresAt));
  const matchingBeats = availableBeats.filter((beat) => beat.id === selectedBeatId || `${beat.caseNumber} ${beat.title}`.toLocaleLowerCase().includes(beatQuery.trim().toLocaleLowerCase()));
  const [message, setMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  async function createLicense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage(null);
    setDownloadUrl(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      beatId: String(formData.get("beatId") ?? ""),
      ...(selectedBuyer ? { buyerUserId: selectedBuyer.id } : {}),
      buyerName: String(formData.get("buyerName") ?? ""),
      buyerEmail: String(formData.get("buyerEmail") ?? ""),
      buyerCountry: String(formData.get("buyerCountry") ?? ""),
      buyerCity: String(formData.get("buyerCity") ?? ""),
      buyerStageName: String(formData.get("buyerStageName") ?? ""),
      buyerPhone: String(formData.get("buyerPhone") ?? ""),
      amount: Number(formData.get("amount")),
      currency: String(formData.get("currency")),
      contractLanguage: String(formData.get("contractLanguage")),
      buyerAcceptedTerms: formData.get("buyerAcceptedTerms") === "on",
      buyerConsentedToData: formData.get("buyerConsentedToData") === "on",
    };

    try {
      const response = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as {
        orderId?: string;
        downloadUrl?: string | null;
        pdfReady?: boolean;
        buyerLinked?: boolean;
        error?: string;
      };

      if (!response.ok || !result.orderId) {
        setMessage(result.error ?? "Не удалось создать лицензию.");
        return;
      }

      setMessage(result.pdfReady
        ? "Сделка записана, бит помечен как SOLD, лицензия сформирована."
        : "Сделка записана и бит помечен как SOLD, но PDF не сформирован. Создайте документ из списка ниже.");
      if (result.buyerLinked) setMessage((message) => `${message} Покупка привязана к аккаунту, начислено 25 поинтов.`);
      setDownloadUrl(result.downloadUrl ?? null);
      form.reset();
      setSelectedBeatId(""); setBeatQuery(""); setSelectedBuyer(null); setBuyerEmail("");
      router.refresh();
    } catch {
      setMessage("Не удалось связаться с сервером.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function getLicensePdf(orderId: string) {
    setPdfLoadingId(orderId);
    setMessage(null);
    setDownloadUrl(null);
    try {
      const response = await fetch(`/api/admin/licenses/${orderId}/pdf`, { method: "POST" });
      const result = await response.json() as { downloadUrl?: string; error?: string };
      if (!response.ok || !result.downloadUrl) {
        setMessage(result.error ?? "Не удалось подготовить PDF.");
        return;
      }
      setDownloadUrl(result.downloadUrl);
    } catch {
      setMessage("Не удалось связаться с сервером.");
    } finally {
      setPdfLoadingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {message ? <p className="case-panel p-4 text-sm" role="status">{message}</p> : null}
      {downloadUrl ? <a className="inline-block text-sm underline" href={downloadUrl} target="_blank" rel="noreferrer">Скачать PDF лицензии</a> : null}
      {canCreateSales ? (
        <section className="case-panel p-6">
          <h2 className="font-sans text-3xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">
            Ручная продажа / Manual Sale
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-paper-200)]">
            Для сделок через Telegram/VK. Отметьте оплату и согласия только после подтверждения покупателя.
            После сохранения бит нельзя продать повторно.
          </p>

          <form onSubmit={createLicense} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset disabled={isSubmitting} className="space-y-3 sm:col-span-2">
                <legend className="text-xs uppercase tracking-[0.16em] text-[var(--color-paper-200)]">Выберите бит</legend>
                <label htmlFor={beatSearchId} className="sr-only">Поиск бита по названию или номеру</label>
                <input id={beatSearchId} type="search" value={beatQuery} onChange={(event) => setBeatQuery(event.target.value)} placeholder="Поиск по названию или номеру CASE" autoComplete="off" className="w-full border border-stone-600 bg-[#080808] px-3 py-3 text-base text-stone-100 outline-none focus:border-amber-500" />
                <div className="max-h-64 space-y-2 overflow-y-auto border border-stone-700 bg-[#0c0c0c] p-2">
                  {matchingBeats.map((beat) => <label key={beat.id} className={`flex cursor-pointer items-start gap-3 border p-3 text-left ${selectedBeatId === beat.id ? "border-amber-500 bg-amber-950/40 text-amber-100" : "border-stone-700 bg-[#171614] text-stone-100 hover:border-stone-400"}`}>
                    <input className="mt-1 accent-amber-500" type="radio" name="beatId" required value={beat.id} checked={selectedBeatId === beat.id} onChange={() => setSelectedBeatId(beat.id)} />
                    <span className="min-w-0"><span className="block text-base leading-6">{beat.title}</span><span className="mt-1 block text-xs text-stone-300">{beat.caseNumber}</span></span>
                  </label>)}
                  {!matchingBeats.length ? <p className="p-3 text-sm text-stone-300">Биты не найдены.</p> : null}
                </div>
                <p className="text-xs text-stone-400">Доступно для продажи: {availableBeats.length}. Проданные биты исключены.</p>
              </fieldset>
              <RegisteredBuyerPicker selected={selectedBuyer} onSelect={(buyer) => { setSelectedBuyer(buyer); if (buyer) setBuyerEmail(buyer.email); }} />
              <label className={labelClass}>
                Цена
                <input className={fieldClass} name="amount" type="number" min="1" step="1" required />
              </label>
              <label className={labelClass}>
                Валюта
                <select className={`${fieldClass} [color-scheme:dark] [&>option]:bg-[#171614] [&>option]:text-stone-100`} name="currency" defaultValue="RUB">
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className={labelClass}>
                Язык договора
                <select className={`${fieldClass} [color-scheme:dark] [&>option]:bg-[#171614] [&>option]:text-stone-100`} name="contractLanguage" defaultValue="ru">
                  <option value="ru">Русский (RU + EN PDF)</option>
                  <option value="en">English (RU + EN PDF)</option>
                </select>
              </label>
              <label className={labelClass}>
                ФИО / Полное имя
                <input className={fieldClass} name="buyerName" autoComplete="name" required minLength={2} maxLength={180} />
              </label>
              <label className={labelClass}>
                Псевдоним артиста
                <input className={fieldClass} name="buyerStageName" required maxLength={120} />
              </label>
              <label className={labelClass}>
                Email
                <input className={fieldClass} name="buyerEmail" type="email" autoComplete="email" required value={buyerEmail} readOnly={Boolean(selectedBuyer)} onChange={(event) => setBuyerEmail(event.target.value)} />
              </label>
              <label className={labelClass}>
                Телефон (необязательно)
                <input className={fieldClass} name="buyerPhone" type="tel" maxLength={60} />
              </label>
              <label className={labelClass}>
                Страна
                <input className={fieldClass} name="buyerCountry" required maxLength={120} />
              </label>
              <label className={labelClass}>
                Город
                <input className={fieldClass} name="buyerCity" required maxLength={120} />
              </label>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 text-sm text-[var(--color-paper-200)]">
                <input className="mt-1 accent-[var(--color-paper-200)]" type="checkbox" name="buyerAcceptedTerms" required />
                <span>Оплата получена, покупатель подтвердил согласие с условиями эксклюзивной лицензии.</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-[var(--color-paper-200)]">
                <input className="mt-1 accent-[var(--color-paper-200)]" type="checkbox" name="buyerConsentedToData" required />
                <span>Покупатель согласился на обработку данных, необходимых для договора.</span>
              </label>
            </div>

            {availableBeats.length === 0 ? <p className="text-sm text-amber-300">Нет доступных битов для продажи.</p> : null}
            <button
              type="submit"
              disabled={isSubmitting || !selectedBeatId || availableBeats.length === 0}
              className="border border-[rgba(185,149,90,0.42)] bg-[rgba(185,149,90,0.12)] px-5 py-3 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] disabled:opacity-50"
            >
              {isSubmitting ? "Сохраняем..." : "Создать лицензию и отметить бит SOLD"}
            </button>
          </form>
        </section>
      ) : (
        <p className="case-panel p-5 text-sm text-[var(--color-paper-200)]">
          Создавать ручные продажи может только администратор.
        </p>
      )}

      <section className="case-panel overflow-hidden">
        <div className="border-b border-[var(--color-line)] p-5">
          <h2 className="font-sans text-3xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">Выданные лицензии</h2>
          <p className="mt-2 text-sm text-[var(--color-paper-200)]">Последние 50 оплаченных заказов: сайт и ручные продажи.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-[var(--color-paper-200)]">
            <thead className="text-xs uppercase tracking-[0.16em] text-[var(--color-paper-400)]">
              <tr>
                <th className="px-5 py-3">Бит</th>
                <th className="px-5 py-3">Покупатель</th>
                <th className="px-5 py-3">Сумма</th>
                <th className="px-5 py-3">Продажа</th>
                <th className="px-5 py-3">PDF</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-t border-[var(--color-line)]">
                  <td className="px-5 py-4">{sale.beatTitle}<br /><span className="text-xs text-[var(--color-paper-400)]">{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(sale.createdAt))}</span></td>
                  <td className="px-5 py-4">{sale.buyerName}<br /><span className="text-xs text-[var(--color-paper-400)]">{sale.buyerEmail}</span><br /><Link className="mt-2 inline-block underline" href={`/orders/${sale.id}`}>{sale.newMessage ? "Новое сообщение — открыть чат" : "Переписка / выдать MP3"}</Link></td>
                  <td className="px-5 py-4">{new Intl.NumberFormat("ru-RU", { style: "currency", currency: sale.currency, maximumFractionDigits: 0 }).format(sale.amount)}</td>
                  <td className="px-5 py-4"><span className="text-amber-200">{sale.provider === "stripe" ? "Stripe · SOLD" : "SOLD"}</span><p className="mt-1 text-xs text-stone-300">{sale.provider === "stripe" ? "Оплачено автоматически" : "Продажа подтверждена"}</p></td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => void getLicensePdf(sale.id)}
                      disabled={pdfLoadingId === sale.id}
                      className="underline decoration-dotted disabled:opacity-50"
                    >
                      {pdfLoadingId === sale.id ? "Готовим..." : sale.hasPdf ? "Скачать / обновить ссылку" : "Сформировать PDF"}
                    </button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 ? (
                <tr><td className="px-5 py-5 text-[var(--color-paper-400)]" colSpan={5}>Покупок пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
