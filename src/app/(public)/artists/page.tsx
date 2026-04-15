import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n-server";

export default async function ArtistsPage() {
  const locale = await getLocale();
  redirect(`/${locale}/artists`);
}