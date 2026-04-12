import Image from "next/image";
import Link from "next/link";
import { PublicAuthStatus } from "@/components/auth/public-auth-status";
import { getPublicSessionState } from "@/lib/auth/session";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/beats", label: "Archive" },
  { href: "/tracks", label: "Tracks (HaM)" },
  { href: "/artists", label: "Artists" },
  { href: "/auth", label: "Login / Sign Up" },
  { href: "/admin/login", label: "Admin" },
];

export async function PublicHeader() {
  const session = await getPublicSessionState();

  return (
    <header className="relative z-10 border-b border-[var(--color-line)] bg-[rgba(14,18,24,0.9)] backdrop-blur">
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
          <nav className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.22em] text-[var(--color-paper-200)]">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-[var(--color-paper-100)]">
              {item.label}
            </Link>
          ))}
          </nav>
          {session.isAuthenticated && session.email ? <PublicAuthStatus email={session.email} /> : null}
        </div>
      </div>
    </header>
  );
}