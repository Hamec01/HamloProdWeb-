import { AdminBeatCrudManager } from "@/components/admin/admin-beat-crud-manager";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminBeats } from "@/services/content";

export default async function AdminBeatsPage() {
  await requireAdminSession();
  const beats = await getAdminBeats();

  return <AdminBeatCrudManager beats={beats} hasSupabase={false} />;
}