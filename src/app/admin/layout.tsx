import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 px-6 py-8 pb-32">
      <AdminSidebar />
      <main className="flex-1">{children}</main>
    </div>
  );
}