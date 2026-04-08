import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { getArtists } from "@/services/content";

export default async function AdminArtistsPage() {
  const artists = await getArtists();

  return (
    <AdminCollectionTable
      title="Artists CRUD"
      description="Artist profiles and streaming links should be maintained through admin workflows, not public pages."
      columns={["Artist", "Track", "Beat"]}
      rows={artists.map((artist) => [artist.artistName, artist.trackTitle, artist.beatTitle])}
    />
  );
}