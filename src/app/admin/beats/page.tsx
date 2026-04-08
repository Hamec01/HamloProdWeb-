import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { getBeats } from "@/services/content";

export default async function AdminBeatsPage() {
  const beats = await getBeats();

  return (
    <AdminCollectionTable
      title="Beats CRUD"
      description="Temporary records shown below are typed mock data. The public site should never require manual code edits to add new beats."
      columns={["Title", "BPM", "Mood", "Status"]}
      rows={beats.map((beat) => [beat.title, String(beat.bpm), beat.mood, beat.status])}
    />
  );
}