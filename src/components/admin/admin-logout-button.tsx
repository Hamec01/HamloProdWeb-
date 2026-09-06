"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/admin/auth/logout", { method: "POST" });
        } catch {
          // logout is best-effort — cookie is cleared by the response anyway
        } finally {
          router.push("/admin/login");
          router.refresh();
        }
      }}
      className="mt-3 w-full border border-[var(--color-line)] px-3 py-2 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)] transition-colors hover:border-[var(--color-alert)] hover:text-[var(--color-alert)] disabled:opacity-50"
    >
      {busy ? "…" : "Log out"}
    </button>
  );
}
