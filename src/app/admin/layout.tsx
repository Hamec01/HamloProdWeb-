import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminSessionRefresher } from "@/components/admin/admin-session-refresher";
import { AdminWorkspace } from "@/components/layout/admin-workspace";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminWorkspace navigation={<AdminSidebar />}>
      <AdminSessionRefresher />
      {children}
    </AdminWorkspace>
  );
}
