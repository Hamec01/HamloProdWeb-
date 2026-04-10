import { AdminTrackCrudManager } from "@/components/admin/admin-track-crud-manager";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminTrackDownloads, getAdminTracks } from "@/services/content";

export default async function AdminTracksPage() {
  const session = await requireAdminSession();
  const [tracks, downloadLogs] = await Promise.all([getAdminTracks(), getAdminTrackDownloads()]);

  return <AdminTrackCrudManager tracks={tracks} downloadLogs={downloadLogs} hasSupabase={session.hasSupabase} />;
}