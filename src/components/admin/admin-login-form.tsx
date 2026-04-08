"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { adminLoginSchema, type AdminLoginValues } from "@/lib/validations/admin-auth";

export function AdminLoginForm({ hasSupabase }: { hasSupabase: boolean }) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: "admin@hamloprod.com",
      password: "password123",
    },
  });

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        if (!hasSupabase) {
          setStatusMessage("Заполни NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY, чтобы включить логин.");
          return;
        }

        setStatusMessage(null);

        try {
          const supabase = createSupabaseBrowserClient();
          const { error } = await supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password,
          });

          if (error) {
            setStatusMessage(error.message);
            return;
          }

          router.push("/admin/dashboard");
          router.refresh();
        } catch (error) {
          setStatusMessage(error instanceof Error ? error.message : "Login failed.");
        }
      })}
      className="case-panel max-w-xl space-y-5 p-6"
    >
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Supabase Ready</p>
        <h1 className="mt-2 font-sans text-4xl uppercase tracking-[0.06em]">Admin Login</h1>
      </div>

      {!hasSupabase ? (
        <div className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--color-paper-200)]">
          Supabase env пока не настроены. После добавления ключей форма будет логинить через Supabase Auth.
        </div>
      ) : null}

      <label className="block space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
        <span>Email</span>
        <input
          {...register("email")}
          className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm outline-none"
        />
        {errors.email ? <span className="text-xs text-[var(--color-alert)]">{errors.email.message}</span> : null}
      </label>

      <label className="block space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
        <span>Password</span>
        <input
          type="password"
          {...register("password")}
          className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm outline-none"
        />
        {errors.password ? <span className="text-xs text-[var(--color-alert)]">{errors.password.message}</span> : null}
      </label>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing In" : "Access Admin"}
      </Button>

      {statusMessage ? (
        <div className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--color-paper-200)]">
          {statusMessage}
        </div>
      ) : null}
    </form>
  );
}