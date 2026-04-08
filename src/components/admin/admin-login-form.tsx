"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { adminLoginSchema, type AdminLoginValues } from "@/lib/validations/admin-auth";

export function AdminLoginForm() {
  const [submitted, setSubmitted] = useState<AdminLoginValues | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: "admin@hamloprod.com",
      password: "password123",
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => setSubmitted(values))} className="case-panel max-w-xl space-y-5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Supabase Ready</p>
        <h1 className="mt-2 font-sans text-4xl uppercase tracking-[0.06em]">Admin Login</h1>
      </div>

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

      <Button type="submit">Access Admin</Button>

      {submitted ? (
        <div className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--color-paper-200)]">
          Form validated. Replace this handler with Supabase auth when credentials are configured.
        </div>
      ) : null}
    </form>
  );
}