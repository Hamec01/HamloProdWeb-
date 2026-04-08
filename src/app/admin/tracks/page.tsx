import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { getTracks } from "@/services/content";

export default async function AdminTracksPage() {
  const tracks = await getTracks();

  return (
    <AdminCollectionTable
      title="Tracks CRUD"
      description="Future track management belongs here and should persist through Supabase instead of page-level hardcoding."
      columns={["Title", "Artist", "Release Date"]}
      rows={tracks.map((track) => [track.title, track.artistName, track.releaseDate])}
    />
  );
}