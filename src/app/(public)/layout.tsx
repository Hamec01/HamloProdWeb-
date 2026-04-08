import type { ReactNode } from "react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { StickyPlayer } from "@/components/player/sticky-player";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="archive-shell">
      <PublicHeader />
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-20 px-6 pb-36 pt-10">
        {children}
      </main>
      <PublicFooter />
      <StickyPlayer />
    </div>
  );
}