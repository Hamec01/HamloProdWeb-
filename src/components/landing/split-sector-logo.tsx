import Link from "next/link";
import { sectorLabels, type SectorKey } from "@/lib/market";
import type { Locale } from "@/lib/i18n";

const shiftClasses = [
  "group-hover:-translate-x-4 group-hover:-translate-y-4",
  "group-hover:translate-x-4 group-hover:-translate-y-4",
  "group-hover:-translate-x-4 group-hover:translate-y-4",
  "group-hover:translate-x-4 group-hover:translate-y-4",
] as const;

const logoPositions = ["left top", "right top", "left bottom", "right bottom"] as const;

const panelBackgrounds: Record<SectorKey, string> = {
  beats: 'linear-gradient(rgba(9,10,11,0.35), rgba(9,10,11,0.62)), radial-gradient(circle at top left, rgba(180,140,85,0.22), transparent 45%), url("/%D0%A1%D0%BB%D0%BE%D0%B9%203.png")',
  vst: 'linear-gradient(rgba(9,10,11,0.35), rgba(9,10,11,0.62)), radial-gradient(circle at top right, rgba(95,145,180,0.22), transparent 45%), url("/%D0%A1%D0%BB%D0%BE%D0%B9%203.png")',
  ham: 'linear-gradient(rgba(9,10,11,0.35), rgba(9,10,11,0.62)), radial-gradient(circle at bottom left, rgba(145,90,180,0.22), transparent 45%), url("/%D0%A1%D0%BB%D0%BE%D0%B9%203.png")',
  artists: 'linear-gradient(rgba(9,10,11,0.35), rgba(9,10,11,0.62)), radial-gradient(circle at bottom right, rgba(80,150,120,0.22), transparent 45%), url("/%D0%A1%D0%BB%D0%BE%D0%B9%203.png")',
};

const sectors: SectorKey[] = ["beats", "vst", "ham", "artists"];

export function SplitSectorLogo({ locale }: { locale: Locale }) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-[1px] overflow-hidden border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
      {sectors.map((sector, index) => (
        <Link key={sector} href={`/${locale}/${sector}`} className="group relative block min-h-[240px] overflow-hidden bg-[rgba(12,11,9,0.95)] sm:min-h-[280px]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-90"
            style={{ backgroundImage: panelBackgrounds[sector] }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(5,6,8,0.86)] via-transparent to-transparent" />
          <div className="absolute left-4 top-4 z-10 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--color-paper-100)]">{sectorLabels[locale][sector]}</p>
          </div>
          <div
            className={`absolute inset-0 z-20 border border-transparent bg-no-repeat transition-transform duration-500 ease-out ${shiftClasses[index]}`}
            style={{
              backgroundImage: 'url("/logo.png")',
              backgroundSize: "200% 200%",
              backgroundPosition: logoPositions[index],
            }}
          />
          <div className="absolute inset-0 z-30 border border-transparent transition-colors duration-300 group-hover:border-[rgba(255,255,255,0.22)]" />
        </Link>
      ))}
    </div>
  );
}
