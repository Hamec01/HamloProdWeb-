import type { Metadata } from "next";
import Link from "next/link";
import { HpdgDownloadForm } from "@/components/hpdg/hpdg-download-form";
import { prisma } from "@/lib/db/client";
import { downloadCopy, pickDownloadLocale } from "@/lib/hpdg/download-page";
import { HPDG_PLATFORM } from "@/lib/hpdg/release";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Download HPDG | HamloProd",
  description: "Download the current HPDG version with your license key.",
  robots: { index: false, follow: false },
};

async function currentRelease() {
  try {
    return await prisma.hpdgRelease.findFirst({
      where: { isCurrent: true, platform: HPDG_PLATFORM },
      select: { version: true, title: true, size: true },
    });
  } catch {
    return null;
  }
}

/** Buyer download page: license key → current installer (same check and daily limit as the plugin). */
export default async function HpdgDownloadPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const [{ lang }, cookieLocale, release] = await Promise.all([searchParams, getLocale(), currentRelease()]);
  const locale = pickDownloadLocale(lang, cookieLocale);
  const copy = downloadCopy[locale];

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <div className="case-panel space-y-6 p-6 sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">{copy.eyebrow}</p>
          <h1 className="mt-3 font-sans text-4xl uppercase tracking-[0.06em] text-[var(--color-paper-100)] sm:text-5xl">{copy.title}</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--color-paper-200)]">{copy.intro}</p>
          <p className="mt-2 text-sm text-[var(--color-paper-400)]">
            {release ? `${copy.current}: ${release.title} · Windows 10/11 x64 · ${(release.size / 1024 / 1024).toFixed(0)} MB` : copy.none}
          </p>
        </div>
        <HpdgDownloadForm locale={locale} />
      </div>

      <div className="case-panel space-y-3 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">{copy.stepsTitle}</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-7 text-[var(--color-paper-200)]">
          {copy.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <p className="pt-2 text-sm text-[var(--color-paper-400)]">
          {copy.noKey}{" "}
          <Link href={`/${locale}/vst`} className="text-[var(--color-paper-100)] underline">{copy.buy}</Link>
        </p>
      </div>
    </section>
  );
}
