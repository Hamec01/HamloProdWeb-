import { redirect } from "next/navigation";
import { getAdminSessionState } from "@/lib/auth/session";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await getAdminSessionState();

  if (session.isAuthenticated) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10">
      <AdminLoginForm />
    </div>
  );
}
