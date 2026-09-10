import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { requireAdminSession } from "@/lib/auth/session";
import { getArtists, getBeats, getTracks } from "@/services/content";

export default async function AdminDashboardPage() {
  await requireAdminSession();
  const [beats, tracks, artists] = await Promise.all([getBeats(), getTracks(), getArtists()]);

  return (
    <div className="space-y-6">
      <section className="case-panel p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Closed Circuit</p>
        <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Dashboard</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
          This area is reserved for create, update and delete operations. Public routes intentionally expose no authoring actions.
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
      </div>

      <AdminCollectionTable
        title="Pipeline"
        description="Own auth, PostgreSQL CRUD, Contabo storage and orders."
        columns={["Collection", "Source", "Rule"]}
        rows={[
          ["Beats", "PostgreSQL", "Admin/editor only CRUD"],
          ["Tracks", "PostgreSQL", "Admin/editor only CRUD"],
          ["Artists", "PostgreSQL", "Admin/editor only CRUD"],
        ]}
      />
    </div>
  );
}