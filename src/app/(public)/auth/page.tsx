import { PublicAuthForm } from "@/components/auth/public-auth-form";
import { getPublicSessionState } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";

export default async function PublicAuthPage() {
  const [session, locale] = await Promise.all([getPublicSessionState(), getLocale()]);

  return <PublicAuthForm hasSupabase={session.hasSupabase} isAuthenticated={session.isAuthenticated} email={session.email} locale={locale} />;
}