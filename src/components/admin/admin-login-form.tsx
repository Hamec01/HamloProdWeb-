"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { adminLoginSchema, type AdminLoginValues } from "@/lib/validations/admin-auth";

export function AdminLoginForm() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setStatusMessage(null);

        try {
          const response = await fetch("/api/admin/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: values.email, password: values.password }),
          });

          if (response.ok) {
            router.push("/admin/dashboard");
            router.refresh();
            return;
          }

          if (response.status === 429) {
            const payload = (await response.json().catch(() => null)) as { retryAfterSeconds?: number } | null;
            const minutes = payload?.retryAfterSeconds ? Math.ceil(payload.retryAfterSeconds / 60) : 15;
            setStatusMessage(`Слишком много попыток. Повтори через ~${minutes} мин.`);
            return;
          }

          if (response.status === 503) {
            setStatusMessage("Авторизация ещё не настроена на сервере.");
            return;
          }

          setStatusMessage("Неверный email или пароль.");
        } catch {
          setStatusMessage("Сеть недоступна. Попробуй ещё раз.");
        }
      })}
      className="case-panel max-w-xl space-y-5 p-6"
    >
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Closed Circuit</p>
        <h1 className="mt-2 font-sans text-4xl uppercase tracking-[0.06em]">Admin Login</h1>
      </div>

      <label className="block space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
        <span>Email</span>
        <input
          autoComplete="username"
          {...register("email")}
          className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm outline-none"
        />
        {errors.email ? <span className="text-xs text-[var(--color-alert)]">{errors.email.message}</span> : null}
      </label>

      <label className="block space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
        <span>Password</span>
        <input
          type="password"
          autoComplete="current-password"
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
