import { redirect } from "next/navigation";

export default async function SectorBeatCasePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/beats/${slug}`);
}
