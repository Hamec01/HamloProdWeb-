import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { getAdminOrders, getArtists, getBeats, getTracks } from "@/services/content";

export default async function AdminDashboardPage() {
  const [beats, tracks, artists, orders] = await Promise.all([getBeats(), getTracks(), getArtists(), getAdminOrders()]);

  const paidOrders = orders.filter((o) => o.status === "paid").length;
  const draftOrders = orders.filter((o) => o.status === "draft").length;

  return (
    <div className="space-y-6">
      <section className="case-panel p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Closed Circuit</p>
        <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Dashboard</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
          Управление каталогом, заказами и медиа-ресурсами. Публичные маршруты недоступны для редактирования.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="case-panel p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-400)]">Beats</p>
          <p className="mt-3 font-sans text-5xl uppercase">{beats.length}</p>
        </div>
        <div className="case-panel p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-400)]">Tracks</p>
          <p className="mt-3 font-sans text-5xl uppercase">{tracks.length}</p>
        </div>
        <div className="case-panel p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-400)]">Artists</p>
          <p className="mt-3 font-sans text-5xl uppercase">{artists.length}</p>
        </div>
        <div className="case-panel p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-400)]">Orders Total</p>
          <p className="mt-3 font-sans text-5xl uppercase">{orders.length}</p>
        </div>
        <div className="case-panel p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-400)]">Orders Paid</p>
          <p className="mt-3 font-sans text-5xl uppercase">{paidOrders}</p>
        </div>
        <div className="case-panel p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-400)]">Orders Draft</p>
          <p className="mt-3 font-sans text-5xl uppercase">{draftOrders}</p>
        </div>
      </div>

      <AdminCollectionTable
        title="Collections"
        description="Все CRUD-операции выполняются через отдельные разделы в левой навигации."
        columns={["Collection", "Source", "Rule"]}
        rows={[
          ["Beats", "Supabase table beats", "Admin/editor only CRUD"],
          ["Tracks", "Supabase table tracks", "Admin/editor only CRUD"],
          ["Artists", "Supabase table artists", "Admin/editor only CRUD"],
          ["Orders", "Supabase table orders", "Admin/editor — status update"],
        ]}
      />
    </div>
  );
}