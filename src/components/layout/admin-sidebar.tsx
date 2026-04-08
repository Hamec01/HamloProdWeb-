import Link from "next/link";

const adminNavigation = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/beats", label: "Beats CRUD" },
  { href: "/admin/tracks", label: "Tracks CRUD" },
  { href: "/admin/artists", label: "Artists CRUD" },
];

export function AdminSidebar() {
  return (
    <aside className="case-panel h-fit min-w-64 p-5">
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
    </aside>
  );
}