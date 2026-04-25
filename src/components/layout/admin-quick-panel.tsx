"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, X } from "lucide-react";

const quickActions = [
  { href: "/admin/tracks", label: "+ Трек / Демо" },
  { href: "/admin/beats", label: "+ Бит" },
  { href: "/admin/releases", label: "+ Релиз" },
  { href: "/admin/artists", label: "+ Артист" },
  { href: "/admin/posts", label: "+ Новость" },
  { href: "/admin/dashboard", label: "Dashboard" },
];

export function AdminQuickPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-36 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <nav className="flex flex-col gap-1 border border-[var(--color-line)] bg-[rgba(12,11,9,0.97)] p-2 backdrop-blur">
          <p className="mb-1 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-amber-500/70">
            Admin
          </p>
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => setOpen(false)}
              className="border border-transparent px-4 py-2 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-200)] transition-colors hover:border-[var(--color-line)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--color-paper-100)]"
            >
              {action.label}
            </Link>
          ))}
        </nav>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="border border-amber-500/50 bg-[rgba(12,11,9,0.95)] p-2 text-amber-400 transition-colors hover:border-amber-400 hover:text-amber-300"
        aria-label={open ? "Закрыть панель" : "Открыть панель администратора"}
        title="Admin"
      >
        {open ? <X className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
      </button>
    </div>
  );
}
