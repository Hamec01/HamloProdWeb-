import Link from "next/link";
import { sectorLabels, type SectorKey } from "@/lib/market";
import type { Locale } from "@/lib/i18n";

const sectors: Array<{ key: SectorKey; image: string }> = [
  { key: "beats", image: "/sectors/beats.png" },
  { key: "vst", image: "/sectors/vst.png" },
  { key: "ham", image: "/sectors/ham.png" },
  { key: "artists", image: "/sectors/artists.png" },
];

export function SplitSectorLogo({ locale }: { locale: Locale }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 sm:grid-cols-2">
      {sectors.map((sector) => (
        <Link
          key={sector.key}
          href={`/${locale}/${sector.key}`}
          className="group relative block overflow-hidden border border-[var(--color-line)] bg-[rgba(12,11,9,0.95)]"
        >
          <div
            className="h-[240px] bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03] sm:h-[280px]"
            style={{ backgroundImage: `linear-gradient(rgba(9,10,11,0.18), rgba(9,10,11,0.5)), url(${sector.image})` }}
          />
          <div className="absolute inset-0 border border-transparent transition-colors duration-300 group-hover:border-[rgba(255,255,255,0.22)]" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(5,6,8,0.92)] to-transparent p-5 text-left">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--color-paper-100)]">{sectorLabels[locale][sector.key]}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
