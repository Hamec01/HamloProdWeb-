import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { PublicAuthStatus } from "@/components/auth/public-auth-status";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { dictionary, type Locale } from "@/lib/i18n";

export async function SectorHeader({ locale }: { locale: Locale }) {
  const session = await getPublicSessionState();
  const t = dictionary[locale];

  const navigation = [
    { href: `/${locale}`, label: t.navHome },
    { href: "/beats", label: locale === "ru" ? "Биты" : "Beats" },
    ...(!session.isAuthenticated ? [{ href: "/auth", label: t.navAuth }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[rgba(0,0,0,0.985)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center">
          <Image src="/logo.png" alt="HamloProd" width={160} height={48} priority className="h-8 max-w-24 w-auto object-contain sm:h-10 sm:max-w-none" />
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <LanguageSwitcher locale={locale} />
          <nav className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.22em] text-[var(--color-paper-200)]">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className={`${item.href === `/${locale}` ? "hidden sm:inline" : ""} transition-colors hover:text-[var(--color-paper-100)]`}>
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
