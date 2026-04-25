import { getAdminSessionState } from "@/lib/auth/session";
import { AdminQuickPanel } from "@/components/layout/admin-quick-panel";

export async function AdminQuickPanelServer() {
  const session = await getAdminSessionState();
  if (!session.isAuthenticated) return null;
  return <AdminQuickPanel />;
}
