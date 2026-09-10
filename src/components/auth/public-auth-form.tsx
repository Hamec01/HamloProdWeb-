"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/lib/i18n";

export function PublicAuthForm({
  isAuthenticated,
  email,
  locale,
}: {
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

  const copy =
    locale === "ru"
      ? {
          heading: "Бесплатный MP3 доступ",
          note: "Зарегистрированные пользователи могут бесплатно скачивать MP3 релизы. Все скачивания логируются в админке.",
          alreadyIn: `Вход уже выполнен как ${email}. Можешь вернуться к трекам и скачать доступный MP3.`,
          login: "Вход",
          signUp: "Регистрация",
          password: "Пароль",
          submitting: "Отправка",
          createAccount: "Создать аккаунт",
          authFailed: "Ошибка авторизации.",
          tooMany: "Слишком много попыток. Попробуй позже.",
          googleNote:
            "Вход через Google временно недоступен. Если ты регистрировался через Google — напиши в поддержку, доступ восстановят вручную.",
        }
      : {
          heading: "Free MP3 Access",
          note: "Registered users can download MP3 releases for free. All downloads are logged in admin.",
          alreadyIn: `You are already signed in as ${email}. You can return to tracks and download available MP3 files.`,
          login: "Login",
          signUp: "Sign Up",
          password: "Password",
          submitting: "Submitting",
          createAccount: "Create Account",
          authFailed: "Auth failed.",
          tooMany: "Too many attempts. Try again later.",
          googleNote:
            "Google sign-in is temporarily unavailable. If you registered with Google, contact support to restore access manually.",
        };

  return (
    <section className="case-panel mx-auto max-w-xl space-y-6 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Public Auth</p>
        <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">{copy.heading}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--color-paper-200)]">{copy.note}</p>
      </div>

      {isAuthenticated ? (
        <div className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--color-paper-200)]">
          {copy.alreadyIn}
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setIsSubmitting(true);
            setStatusMessage(null);

            try {
              const response = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ email: formState.email, password: formState.password }),
              });

              if (response.ok) {
                router.push(nextPath);
                router.refresh();
                return;
              }

              const data = (await response.json().catch(() => null)) as { error?: string } | null;
              setStatusMessage(
                response.status === 429 ? copy.tooMany : data?.error ?? copy.authFailed,
              );
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
              autoComplete="email"
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
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
          </label>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? copy.submitting : mode === "login" ? copy.login : copy.createAccount}
          </Button>

          <p className="text-xs leading-6 text-[var(--color-paper-400)]">{copy.googleNote}</p>

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
