import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { PublicAuthStatus } from "@/components/auth/public-auth-status";
import { getPublicSessionState } from "@/lib/auth/session";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export async function PublicHeader() {
  const [session, locale] = await Promise.all([getPublicSessionState(), getLocale()]);
  const t = dictionary[locale];
  const navigation = [
    { href: "/", label: t.navHome },
    { href: "/beats", label: t.navArchive },
    { href: "/tracks", label: t.navTracks },
    { href: "/artists", label: t.navArtists },
    { href: "/auth", label: t.navAuth },
    { href: "/admin/login", label: t.navAdmin },
  ];

  return (
    <header className="relative z-10 border-b border-[var(--color-line)] bg-[rgba(12,11,9,0.92)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="HamloProd"
            width={160}
            height={48}
            priority
            className="h-10 w-auto object-contain"
          />
        </Link>
        <div className="flex flex-col gap-4 sm:items-end">
          <LanguageSwitcher locale={locale} />
          <nav className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.22em] text-[var(--color-paper-200)]">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-[var(--color-paper-100)]">
              {item.label}
            </Link>
          ))}
          </nav>
          {session.isAuthenticated && session.email ? <PublicAuthStatus email={session.email} locale={locale} /> : null}
        </div>
      </div>
    </header>
  );
}