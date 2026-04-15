import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n-server";

export default async function BeatCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  redirect(`/${locale}/beats/${slug}`);
}