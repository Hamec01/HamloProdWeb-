"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { type Locale } from "@/lib/i18n";

export function PublicAuthForm({
  hasSupabase,
  isAuthenticated,
  email,
  locale,
}: {
  hasSupabase: boolean;
  isAuthenticated: boolean;
  email: string | null;
  locale: Locale;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/tracks";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [formState, setFormState] = useState({ email: "", password: "" });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const copy = locale === "ru"
    ? {
        heading: "Бесплатный MP3 доступ",
        note: "Зарегистрированные пользователи могут бесплатно скачивать MP3 релизы. Все скачивания логируются в админке.",
        noEnv: "Supabase env не настроены. Публичная регистрация пока недоступна.",
        alreadyIn: `Вход уже выполнен как ${email}. Можешь вернуться к трекам и скачать доступный MP3.`,
        login: "Вход",
        signUp: "Регистрация",
        password: "Пароль",
        submitting: "Отправка",
        createAccount: "Создать аккаунт",
        authFailed: "Ошибка авторизации.",
      }
    : {
        heading: "Free MP3 Access",
        note: "Registered users can download MP3 releases for free. All downloads are logged in admin.",
        noEnv: "Supabase env is not configured. Public registration is unavailable.",
        alreadyIn: `You are already signed in as ${email}. You can return to tracks and download available MP3 files.`,
        login: "Login",
        signUp: "Sign Up",
        password: "Password",
        submitting: "Submitting",
        createAccount: "Create Account",
        authFailed: "Auth failed.",
      };

  return (
    <section className="case-panel mx-auto max-w-xl space-y-6 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Public Auth</p>
        <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">{copy.heading}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--color-paper-200)]">
          {copy.note}
        </p>
      </div>

      {!hasSupabase ? (
        <div className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--color-paper-200)]">
          {copy.noEnv}
        </div>
      ) : null}

      {isAuthenticated ? (
        <div className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--color-paper-200)]">
          {copy.alreadyIn}
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();

            if (!hasSupabase) {
              setStatusMessage("Supabase env не настроены.");
              return;
            }

            setIsSubmitting(true);
            setStatusMessage(null);

            try {
              const supabase = createSupabaseBrowserClient();
              if (mode === "signup") {
                const { error } = await supabase.auth.signUp({
                  email: formState.email,
                  password: formState.password,
                });

                if (error) {
                  setStatusMessage(error.message);
                  return;
                }

                setStatusMessage(
                  locale === "ru"
                    ? "Аккаунт создан. Если Supabase требует email confirmation, подтверди почту и войди."
                    : "Account created. If Supabase requires email confirmation, confirm your email and sign in.",
                );
                return;
              }

              const { error } = await supabase.auth.signInWithPassword({
                email: formState.email,
                password: formState.password,
              });

              if (error) {
                setStatusMessage(error.message);
                return;
              }

              router.push(nextPath);
              router.refresh();
            } catch (error) {
              setStatusMessage(error instanceof Error ? error.message : copy.authFailed);
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <div className="flex gap-2">
            <Button type="button" variant={mode === "login" ? "primary" : "ghost"} onClick={() => setMode("login")}>
              {copy.login}
            </Button>
            <Button type="button" variant={mode === "signup" ? "primary" : "ghost"} onClick={() => setMode("signup")}>
              {copy.signUp}
            </Button>
          </div>

          <label className="block space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Email</span>
            <input
              type="email"
              value={formState.email}
              onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
              required
            />
          </label>

          <label className="block space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>{copy.password}</span>
            <input
              type="password"
              value={formState.password}
              onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
              minLength={6}
              required
            />
          </label>

          <Button type="submit" disabled={isSubmitting || !hasSupabase}>
            {isSubmitting ? copy.submitting : mode === "login" ? copy.login : copy.createAccount}
          </Button>

          {statusMessage ? (
            <div className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--color-paper-200)]">
              {statusMessage}
            </div>
          ) : null}
        </form>
      )}
    </section>
  );
}