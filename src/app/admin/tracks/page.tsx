import { AdminTrackCrudManager } from "@/components/admin/admin-track-crud-manager";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminTracks } from "@/services/content";

export default async function AdminTracksPage() {
  const session = await requireAdminSession();
  const tracks = await getAdminTracks();

  return <AdminTrackCrudManager tracks={tracks} hasSupabase={session.hasSupabase} />;
}