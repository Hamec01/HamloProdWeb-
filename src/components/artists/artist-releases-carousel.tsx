"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { dictionary, type Locale } from "@/lib/i18n";
import type { Release } from "@/types";

export function ArtistReleasesCarousel({
  releases,
  locale,
  artistSlug,
}: {
  releases: Release[];
  locale: Locale;
  artistSlug: string;
}) {
  const t = dictionary[locale];
  const trackRef = useRef<HTMLDivElement>(null);

  if (releases.length === 0) return null;

  // Duplicate for seamless infinite loop
  const items = [...releases, ...releases];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden" ref={trackRef}>
        <div
          className="flex gap-4"
          style={{
            animation: `artist-carousel-scroll ${releases.length * 4}s linear infinite`,
            width: "max-content",
          }}
        >
          {items.map((release, i) => (
            <ReleaseCarouselCard key={`${release.id}-${i}`} release={release} locale={locale} />
          ))}
        </div>
      </div>

      <div className="text-right">
        <Link
          href={`/${locale}/artists/${artistSlug}/music`}
          className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-300)] transition-colors hover:text-amber-400"
        >
          {t.artistAllReleases} →
        </Link>
      </div>

      <style>{`
        @keyframes artist-carousel-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function ReleaseCarouselCard({ release, locale }: { release: Release; locale: Locale }) {
  return (
    <div className="w-44 shrink-0">
      <div
        className={`relative h-44 overflow-hidden border border-[var(--color-line)] bg-gradient-to-br ${release.coverPalette}`}
      >
        {release.coverImageUrl ? (
          <Image
            src={release.coverImageUrl}
            alt={release.title}
            fill
            className="object-cover"
            sizes="176px"
          />
        ) : null}
      </div>
      <div className="mt-2 space-y-0.5">
        <p className="truncate text-xs font-medium text-[var(--color-paper-200)]">{release.title}</p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-paper-400)]">
          {release.releaseType} · {release.releaseDate.slice(0, 4)}
        </p>
      </div>
    </div>
  );
}
