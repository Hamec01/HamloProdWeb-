"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type OrderRequest = { id: string; beatTitle: string; buyerName: string; buyerEmail: string; amount: number; currency: string };

export function ManualLicenseRequests({ orders }: { orders: OrderRequest[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function confirm(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault(); setBusy(orderId); setMessage("");
    try {
      const response = await fetch(`/api/admin/licenses/${orderId}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentReceived: true }) });
      const result = await response.json() as { error?: string; pdfReady?: boolean };
      if (!response.ok) { setMessage(result.error || "Не удалось подтвердить оплату."); return; }
      setMessage(result.pdfReady ? "Оплата подтверждена. PDF доступен покупателю в профиле и в списке лицензий ниже." : "Оплата подтверждена. PDF можно повторно сформировать в списке лицензий ниже.");
      router.refresh();
    } catch { setMessage("Не удалось связаться с сервером."); }
    finally { setBusy(null); }
  }
  return <section className="case-panel p-6">
    <h2 className="font-sans text-3xl uppercase tracking-[0.05em]">Заявки с сайта</h2>
    <p className="mt-3 text-sm text-[var(--color-paper-200)]">Покупатели уже заполнили свои данные. Подтвердите заявку после получения оплаты в Telegram/VK.</p>
    {message ? <p className="mt-4 text-sm" role="status">{message}</p> : null}
    <div className="mt-5 space-y-4">{orders.map((order) => <form key={order.id} onSubmit={(event) => void confirm(event, order.id)} className="border border-[var(--color-line)] p-4 space-y-3">
      <p className="text-sm">{order.beatTitle} — {new Intl.NumberFormat("ru-RU", { style: "currency", currency: order.currency }).format(order.amount)}</p>
      <p className="text-sm text-[var(--color-paper-300)]">{order.buyerName} · {order.buyerEmail}</p>
      <p className="break-all text-xs text-[var(--color-paper-400)]">Заказ: {order.id}</p>
      <label className="flex gap-3 text-sm"><input type="checkbox" name="paymentReceived" required />Оплата получена по этому заказу</label>
      <button type="submit" disabled={busy !== null} className="border border-[var(--color-line)] px-4 py-2 text-sm disabled:opacity-50">{busy === order.id ? "Оформляем..." : "Подтвердить оплату и выдать PDF"}</button>
    </form>)}{orders.length === 0 ? <p className="text-sm text-[var(--color-paper-400)]">Новых заявок нет.</p> : null}</div>
  </section>;
}
