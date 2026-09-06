"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Keeps the admin session fresh from the client.
 *
 *  - polls GET /api/admin/auth/me on an interval (and once on mount);
 *  - if the server says `shouldRefresh`, POSTs /api/admin/auth/refresh ONCE;
 *  - on 401 (from either call) redirects to /admin/login;
 *  - never stores the token/session anywhere — the cookie is httpOnly and does
 *    all the work; this only triggers the server-side rotation.
 *
 * A ref guards against overlapping runs so there is no request loop.
 */
export function AdminSessionRefresher() {
  const router = useRouter();
  const pathname = usePathname();
  const running = useRef(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (running.current || cancelled) return;
      running.current = true;

      try {
        const me = await fetch("/api/admin/auth/me", { cache: "no-store" });

        if (me.status === 401) {
          if (!cancelled) router.push("/admin/login");
          return;
        }

        if (!me.ok) return;

        const data = (await me.json().catch(() => null)) as { session?: { shouldRefresh?: boolean } } | null;

        if (data?.session?.shouldRefresh) {
          const refreshed = await fetch("/api/admin/auth/refresh", { method: "POST", cache: "no-store" });
          if (refreshed.status === 401 && !cancelled) {
            router.push("/admin/login");
          }
        }
      } catch {
        // transient network error — try again on the next interval
      } finally {
        running.current = false;
      }
    };

    void tick();
    const id = setInterval(() => void tick(), CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname, router]);

  return null;
}
