import { getAdminSessionState } from "@/lib/auth/session";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export default async function AdminLoginPage() {
  const session = await getAdminSessionState();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10">
      <AdminLoginForm hasSupabase={session.hasSupabase} />
    </div>
  );
}