import { AdminReleaseCrudManager } from "@/components/admin/admin-release-crud-manager";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminReleases } from "@/services/content";

export default async function AdminReleasesPage() {
  await requireAdminSession();
  const releases = await getAdminReleases();

  return <AdminReleaseCrudManager releases={releases} />;
}
