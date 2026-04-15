"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import type { Order, OrderStatus } from "@/types";

const ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "pending_payment",
  "paid",
  "cancelled",
  "failed",
  "refunded",
];

function formatUsd(value: number) {
  return `$${value}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}

function OrderStatusSelect({
  orderId,
  initialStatus,
  hasSupabase,
  onMessage,
}: {
  orderId: string;
  initialStatus: OrderStatus;
  hasSupabase: boolean;
  onMessage: (message: string) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleChange = (newStatus: OrderStatus) => {
    if (!hasSupabase) {
      onMessage("CRUD активируется после настройки Supabase env и логина.");
      return;
    }

    setStatus(newStatus);
    setIsUpdating(true);

    void fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          onMessage(payload?.error ?? "Status update failed.");
          setStatus(initialStatus);
          return;
        }
        onMessage(`Order ${orderId.slice(0, 8)}… → ${newStatus}`);
        router.refresh();
      })
      .catch(() => {
        onMessage("Network error. Please try again.");
        setStatus(initialStatus);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };

  return (
    <select
      value={status}
      disabled={isUpdating}
      className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-xs uppercase tracking-[0.12em] text-[var(--color-paper-200)] disabled:opacity-50"
      onChange={(event) => handleChange(event.target.value as OrderStatus)}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function AdminOrdersCrudManager({ orders, hasSupabase }: { orders: Order[]; hasSupabase: boolean }) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      orders.map((order) => [
        order.id.slice(0, 8) + "…",
        order.buyerEmail,
        formatUsd(order.finalPriceUsd),
        order.licenseType,
        order.contractLanguage,
        formatDate(order.createdAt),
        <OrderStatusSelect
          key={`status-${order.id}`}
          orderId={order.id}
          initialStatus={order.status}
          hasSupabase={hasSupabase}
          onMessage={setStatusMessage}
        />,
      ]),
    [orders, hasSupabase],
  );

  return (
    <div className="space-y-6">
      <section className="case-panel p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Supabase CRUD</p>
            <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Orders Admin</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
              Список заказов из checkout. Статус каждого заказа можно изменить через выпадающий список.
            </p>
          </div>
          {!hasSupabase ? (
            <div className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--color-paper-200)]">
              Supabase env не настроены. Нет данных для отображения.
            </div>
          ) : null}
        </div>
        {statusMessage ? (
          <p className="mt-4 text-sm text-[var(--color-paper-200)]">{statusMessage}</p>
        ) : null}
      </section>

      <AdminCollectionTable
        title="Existing Orders"
        description="Заказы подгружаются из Supabase. Пустой список при отсутствии заказов или если env не настроены."
        columns={["ID", "Email", "Final Price", "License", "Lang", "Created", "Status"]}
        rows={rows}
      />
    </div>
  );
}
