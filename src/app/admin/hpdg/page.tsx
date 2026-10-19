import { AdminHpdgManager } from "@/components/admin/admin-hpdg-manager";
import { requireAdminSession } from "@/lib/auth/session";
import { listLicenseKeys, listReleases } from "@/lib/hpdg/postgres";

export default async function AdminHpdgPage() {
  const session = await requireAdminSession();
  if (session.role !== "ADMIN") {
    return <p className="case-panel p-6 text-sm text-[var(--color-paper-200)]">HPDG keys and releases are available to ADMIN only.</p>;
  }
  const [releases, keys] = await Promise.all([listReleases(), listLicenseKeys()]);
  return <AdminHpdgManager initialReleases={releases} initialKeys={keys} />;
}
