import Link from "next/link";
import type { Artist } from "@/types";
import type { Locale } from "@/lib/i18n";

const SOCIAL_ICONS: Record<string, string> = {
  spotify: "Spotify",
  appleMusic: "Apple Music",
  youtube: "YouTube",
  vk: "VK",
  telegram: "Telegram",
  yandexMusic: "Яндекс Музыка",
  tidal: "Tidal",
  soundcloud: "SoundCloud",
};

type SocialEntry = { key: string; label: string; url: string };

export function ArtistSocialLinks({ artist }: { artist: Artist; locale: Locale }) {
  const links: SocialEntry[] = [
    { key: "spotify", label: SOCIAL_ICONS.spotify, url: artist.spotifyUrl },
    { key: "appleMusic", label: SOCIAL_ICONS.appleMusic, url: artist.appleMusicUrl },
    { key: "youtube", label: SOCIAL_ICONS.youtube, url: artist.youtubeUrl },
    { key: "vk", label: SOCIAL_ICONS.vk, url: artist.vkUrl },
    { key: "telegram", label: SOCIAL_ICONS.telegram, url: artist.telegramUrl },
    { key: "yandexMusic", label: SOCIAL_ICONS.yandexMusic, url: artist.yandexMusicUrl },
    { key: "tidal", label: SOCIAL_ICONS.tidal, url: artist.tidalUrl },
    { key: "soundcloud", label: SOCIAL_ICONS.soundcloud, url: artist.soundcloudUrl },
  ].filter((l) => Boolean(l.url));

  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em]">
      {links.map((link) => (
        <Link
          key={link.key}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-[var(--color-line)] px-4 py-2 text-[var(--color-paper-200)] transition-colors hover:border-amber-500 hover:text-amber-400"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
