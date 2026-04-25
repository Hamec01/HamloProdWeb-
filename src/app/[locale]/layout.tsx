import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/layout/public-footer";
import { SectorHeader } from "@/components/layout/sector-header";
import { LocaleRouteSync } from "@/components/layout/locale-route-sync";
import { AdminQuickPanelServer } from "@/components/layout/admin-quick-panel-server";
import { normalizeLocale } from "@/lib/market";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  if (!["en", "ru"].includes(rawLocale)) {
    notFound();
  }

  return (
    <div className="archive-shell">
      <LocaleRouteSync locale={locale} />
      <SectorHeader locale={locale} />
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-20 px-6 pb-52 pt-10 md:pb-36">
        {children}
      </main>
      <PublicFooter />
      <AdminQuickPanelServer />
    </div>
  );
}
