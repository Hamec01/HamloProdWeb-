import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { getArtists, getBeats, getTracks } from "@/services/content";

export default async function AdminDashboardPage() {
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
        description="Supabase auth, CRUD, storage and orders will attach here in the next phase."
        columns={["Collection", "Source", "Rule"]}
        rows={[
          ["Beats", "Supabase table beats", "Admin/editor only CRUD"],
          ["Tracks", "Supabase table tracks", "Admin/editor only CRUD"],
          ["Artists", "Supabase table artists", "Admin/editor only CRUD"],
        ]}
      />
    </div>
  );
}