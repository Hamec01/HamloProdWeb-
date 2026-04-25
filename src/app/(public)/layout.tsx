import type { ReactNode } from "react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { AdminQuickPanelServer } from "@/components/layout/admin-quick-panel-server";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="archive-shell">
      <PublicHeader />
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-20 px-6 pb-52 pt-10 md:pb-36">
        {children}
      </main>
      <PublicFooter />
      <AdminQuickPanelServer />
    </div>
  );
}