import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";

const adminNavigation = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/beats", label: "Beats CRUD" },
  { href: "/admin/licenses", label: "Продажи / сообщения" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/tracks", label: "Tracks (синглы)" },
  { href: "/admin/releases", label: "Releases (альбомы)" },
  { href: "/admin/artists", label: "Artists CRUD" },
  { href: "/admin/posts", label: "Posts / News" },
  { href: "/admin/hpdg", label: "HPDG (ключи, релизы, письма)" },
];

export function AdminSidebar() {
  return (
    <aside className="case-panel h-fit min-w-0 w-full p-4">
      <p className="text-xs uppercase tracking-[0.26em] text-[var(--color-paper-400)]">Restricted Records</p>
      <h2 className="mt-3 font-sans text-3xl uppercase tracking-[0.08em]">Admin</h2>
      <div className="case-divider my-5" />
      <nav className="flex flex-col gap-3 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
        {adminNavigation.map((item) => (
          <Link key={item.href} href={item.href} className="border border-transparent px-3 py-3 transition-colors hover:border-[var(--color-line)] hover:bg-[rgba(255,255,255,0.03)]">
            {item.label}
          </Link>
        ))}
      </nav>
      <a href="/api/admin/hpdg808/contacts" download className="mt-3 block px-3 py-3 text-sm text-[var(--color-paper-200)] hover:text-white">
        HPDG 808 — Email CSV ↓
      </a>
      <div className="case-divider my-5" />
      <AdminLogoutButton />
    </aside>
  );
}
