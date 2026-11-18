import Link from "next/link";
import { redirect } from "next/navigation";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getLocale } from "@/lib/i18n-server";
import { getUserConversation } from "@/lib/users/service";
import { UserConversation } from "@/components/orders/user-conversation";
export const dynamic = "force-dynamic";
export default async function ProfileMessagesPage() {
  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) redirect("/auth?next=%2Fprofile%2Fmessages");
  const locale = await getLocale();
  const conversation = await getUserConversation(session.userId, { userId: session.userId, role: "buyer" }, undefined, false);
  return <div className="space-y-6"><Link href="/profile" className="text-sm underline">← {locale === "ru" ? "Мой кабинет" : "My account"}</Link><UserConversation key={session.userId} initial={conversation} role="buyer" locale={locale} /></div>;
}
