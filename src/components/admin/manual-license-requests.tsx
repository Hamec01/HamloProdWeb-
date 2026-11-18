"use client";

import Link from "next/link";
import { BuyerCheckoutLink } from "@/components/orders/buyer-checkout-link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type OrderRequest = { id: string; beatTitle: string; beatSlug: string; buyerName: string; buyerEmail: string; amount: number; currency: string; hasContract: boolean; newMessage: boolean; reservationExpiresAt: string | null };

export function ManualLicenseRequests({ orders, archived = false }: { orders: OrderRequest[]; archived?: boolean }) {
  const router = useRouter();
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 15000); return () => clearInterval(timer); }, [router]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function archive(orderId: string) {
    setBusy(orderId); setMessage("");
    try {
      const response = await fetch(`/api/admin/licenses/${orderId}/archive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: !archived }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setMessage(result.error || "Не удалось изменить список заявок."); return; }
      setMessage(archived ? "Заявка возвращена в активные." : "Заявка убрана в архив. Её можно вернуть из раздела «Архив заявок».");
      router.refresh();
    } catch { setMessage("Не удалось связаться с сервером."); }
    finally { setBusy(null); }
  }
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
    <h2 className="font-sans text-3xl uppercase tracking-[0.05em]">{archived ? "Архив заявок" : "Заявки с сайта"}</h2>
    <div className="mt-4 flex flex-wrap gap-4 text-sm"><Link href="/admin/licenses" className={!archived ? "text-amber-200 underline" : "underline"}>Активные заявки</Link><Link href="/admin/licenses?requests=archived" className={archived ? "text-amber-200 underline" : "underline"}>Архив заявок</Link></div>
    <p className="mt-3 text-sm text-[var(--color-paper-200)]">{archived ? "Убранные заявки. История переписки сохраняется, новое сообщение покупателя вернёт заявку в активные." : "Новые заявки и сообщения от покупателей. Откройте переписку, согласуйте оплату и подтвердите покупку после получения денег. Ненужную заявку можно убрать в архив."}</p>
    {message ? <p className="mt-4 text-sm" role="status">{message}</p> : null}
    <div className="mt-5 space-y-4">{orders.map((order) => <form key={order.id} onSubmit={(event) => void confirm(event, order.id)} className="border border-[var(--color-line)] p-4 space-y-3">
      {order.newMessage ? <p className="text-sm font-semibold text-amber-200">Новое сообщение</p> : null}
      <p className="text-sm">{order.beatTitle} — {new Intl.NumberFormat("ru-RU", { style: "currency", currency: order.currency }).format(order.amount)}</p>
      <p className="text-sm text-[var(--color-paper-300)]">{order.buyerName} · {order.buyerEmail}</p>
      <p className="break-all text-xs text-[var(--color-paper-400)]">Заказ: {order.id}</p>
      <Link className="inline-block border border-amber-700 bg-amber-950/20 px-4 py-2 text-sm text-amber-100" href={`/orders/${order.id}`}>Открыть заявку и переписку</Link>
      <button type="button" disabled={busy !== null} onClick={() => void archive(order.id)} className="ml-3 border border-stone-600 px-4 py-2 text-sm disabled:opacity-50">{busy === order.id ? "Сохраняем…" : archived ? "Вернуть в активные" : "Убрать из списка"}</button>
      {order.reservationExpiresAt ? <p className="text-sm text-amber-200">Бронь до {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Helsinki" }).format(new Date(order.reservationExpiresAt))} (Хельсинки)</p> : null}
      {!order.hasContract ? <p className="text-sm text-[var(--color-paper-300)]">Покупателю нужно заполнить данные для PDF и принять договор. Отправьте ему ссылку на форму ниже.</p> : null}
      {!order.hasContract && !archived ? <BuyerCheckoutLink beatSlug={order.beatSlug} /> : null}
      {!archived ? <><label className="flex gap-3 text-sm"><input type="checkbox" name="paymentReceived" required />Оплата получена по этому заказу</label>
      <button type="submit" disabled={busy !== null || !order.hasContract} className="border border-[var(--color-line)] px-4 py-2 text-sm disabled:opacity-50">{busy === order.id ? "Оформляем..." : "Подтвердить оплату и выдать PDF"}</button></> : null}
    </form>)}{orders.length === 0 ? <p className="text-sm text-[var(--color-paper-400)]">{archived ? "Архив пуст." : "Новых заявок нет."}</p> : null}</div>
  </section>;
}
