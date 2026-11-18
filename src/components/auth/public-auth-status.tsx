"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Coins, FileClock, Headphones, LogOut, Mail, UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { AccountSummary } from "@/lib/account/summary";

export function PublicAuthStatus({ email, locale }: { email: string; locale: Locale }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const ru = locale === "ru";
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/account/summary", { cache: "no-store", signal });
      if (!response.ok) throw Error("SUMMARY_UNAVAILABLE");
      const next = await response.json() as AccountSummary;
      if (!signal?.aborted) { setSummary(next); setError(""); }
    } catch { if (!signal?.aborted) setError(ru ? "Не удалось обновить данные. Откройте меню ещё раз." : "Could not refresh account details. Reopen the menu to retry."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [ru]);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(controller.signal); }, 45000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => { controller.abort(); document.removeEventListener("pointerdown", outside); };
  }, [open, refresh]);
  function keyboard(event: KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
    items[index].focus();
  }
  async function logout() {
    setLoggingOut(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw Error("LOGOUT_FAILED");
      setOpen(false); router.push(`/${locale}`); router.refresh();
    } catch { setError(ru ? "Не удалось выйти. Повторите попытку." : "Could not sign out. Try again."); }
    finally { setLoggingOut(false); }
  }
  const name = summary?.displayName || email.split("@")[0];
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const links = [
    { href: "/beats", label: ru ? "Каталог битов" : "Beat catalogue", icon: Headphones, count: null },
    { href: "/profile", label: ru ? "Мой профиль" : "My profile", icon: UserRound, count: null },
    { href: "/profile?tab=purchases", label: ru ? "Купленные биты" : "Purchased beats", icon: Headphones, count: summary?.purchases },
    { href: "/profile?tab=requests", label: ru ? "Заявки и оплата" : "Requests and payments", icon: FileClock, count: summary?.requests },
    { href: "/profile/messages", label: ru ? "Сообщения" : "Messages", icon: Mail, count: summary?.unread },
    { href: "/profile?tab=points", label: ru ? "Мои поинты" : "My points", icon: Coins, count: summary?.points },
  ];
  return <div ref={container} className="relative" onBlur={(event) => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} id={`${menuId}-trigger`} type="button" aria-label={ru ? "Открыть меню аккаунта" : "Open account menu"} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }} className="relative flex items-center gap-2 rounded-full border border-amber-800/70 bg-[#171511] p-1.5 pr-3 text-sm text-stone-100 transition-colors hover:border-amber-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-800/70 bg-amber-950/40 font-semibold text-amber-200" aria-hidden="true">{initials}</span>
      <span className="hidden sm:inline">{ru ? "Кабинет" : "Account"}</span><ChevronDown size={15} aria-hidden="true" />
      {Boolean(summary?.unread) ? <span data-testid="account-unread" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-amber-400 px-1 text-center text-[11px] font-bold leading-5 text-stone-950">{summary!.unread}</span> : null}
    </button>
    {open ? <div ref={panel} id={menuId} role="menu" aria-labelledby={`${menuId}-trigger`} onKeyDown={keyboard} className="absolute right-0 top-[calc(100%+0.75rem)] z-[90] max-h-[calc(100dvh-6rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-stone-700 bg-[#151412] text-left text-sm normal-case tracking-normal text-stone-100 shadow-2xl shadow-black/70">
      <div className="border-b border-stone-700 p-4">
        <p className="break-words font-semibold">{name}</p><p className="mt-1 break-all text-xs text-stone-400">{email}</p>
        <p className="mt-3 flex items-center gap-2 text-amber-200"><Coins size={17} aria-hidden="true" /><strong data-testid="account-points">{loading && !summary ? "…" : summary?.points ?? "—"}</strong><span>{ru ? "поинтов" : "points"}</span></p>
        <p className="mt-1 text-xs text-stone-400">{ru ? "100 поинтов = бесплатный бит" : "100 points = a free beat"}</p>
      </div>
      <div className="py-2">{links.map(({ href, label, icon: Icon, count }) => <Link key={href} role="menuitem" tabIndex={-1} href={href} onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 px-4 py-3 text-sm hover:bg-stone-800 focus:bg-stone-800 focus:outline-none"><Icon size={18} className="shrink-0 text-stone-400" aria-hidden="true" /><span className="flex-1">{label}</span>{typeof count === "number" ? <span className="rounded bg-stone-800 px-2 py-0.5 text-xs text-amber-200">{count}</span> : null}</Link>)}</div>
      <div className="border-t border-stone-700 py-2"><button type="button" role="menuitem" tabIndex={-1} disabled={loggingOut} onClick={() => void logout()} className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-stone-800 focus:bg-stone-800 focus:outline-none disabled:opacity-50"><LogOut size={18} className="text-stone-400" aria-hidden="true" />{loggingOut ? (ru ? "Выходим…" : "Signing out…") : ru ? "Выйти" : "Sign out"}</button></div>
      {error ? <p role="status" className="px-4 pb-4 text-xs text-amber-200">{error}</p> : null}
    </div> : null}
  </div>;
}
