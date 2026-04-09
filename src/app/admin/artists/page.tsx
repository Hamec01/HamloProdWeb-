import { AdminArtistCrudManager } from "@/components/admin/admin-artist-crud-manager";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminArtists } from "@/services/content";

export default async function AdminArtistsPage() {
  const session = await requireAdminSession();
  const artists = await getAdminArtists();

  return <AdminArtistCrudManager artists={artists} hasSupabase={session.hasSupabase} />;
}