import { PublicAuthForm } from "@/components/auth/public-auth-form";
import { getPublicSessionState } from "@/lib/auth/session";

export default async function PublicAuthPage() {
  const session = await getPublicSessionState();

  return <PublicAuthForm hasSupabase={session.hasSupabase} isAuthenticated={session.isAuthenticated} email={session.email} />;
}