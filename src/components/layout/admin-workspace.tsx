"use client";

import { useRef, type ReactNode } from "react";

export function AdminWorkspace({ children, navigation }: { children: ReactNode; navigation: ReactNode }) {
  const menu = useRef<HTMLDialogElement>(null);

  return (
    <div className="min-h-screen w-full px-4 py-6 pb-32 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          className="border border-[var(--color-line)] px-4 py-3 text-sm hover:border-[var(--color-accent)]"
          aria-haspopup="dialog"
          aria-controls="admin-navigation"
          onClick={() => menu.current?.showModal()}
        >
          ☰ Меню админки
        </button>
        <span className="text-xs uppercase tracking-widest text-[var(--color-paper-400)]">Admin</span>
      </div>
      <dialog
        ref={menu}
        id="admin-navigation"
        aria-label="Меню админки"
        className="fixed inset-0 m-0 h-dvh max-h-none w-80 max-w-[calc(100vw-1rem)] overflow-y-auto border-r border-[var(--color-line)] bg-[#0b0b09] p-4 text-[var(--color-paper-100)] backdrop:bg-black/70"
      >
        <button
          type="button"
          className="mb-4 w-full border border-[var(--color-line)] px-4 py-3 text-sm hover:border-[var(--color-accent)]"
          onClick={() => menu.current?.close()}
        >
          ← Свернуть меню
        </button>
        <div onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) menu.current?.close();
        }}>
          {navigation}
        </div>
      </dialog>
      <main className="min-w-0 w-full">{children}</main>
    </div>
  );
}
