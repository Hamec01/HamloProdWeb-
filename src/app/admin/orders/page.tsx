import { AdminOrdersCrudManager } from "@/components/admin/admin-orders-crud-manager";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminOrders } from "@/services/content";

export default async function AdminOrdersPage() {
  const session = await requireAdminSession();
  const orders = await getAdminOrders();

  return <AdminOrdersCrudManager orders={orders} hasSupabase={session.hasSupabase} />;
}
