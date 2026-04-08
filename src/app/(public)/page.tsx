import Link from "next/link";
import { RandomBeatButton } from "@/components/beats/random-beat-button";
import { BeatGrid } from "@/components/beats/beat-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { getBeats, getSiteSettings } from "@/services/content";

export default async function HomePage() {
  const [settings, beats] = await Promise.all([getSiteSettings(), getBeats()]);

  return (
    <>
      <section className="flex flex-col items-center gap-8 pt-12 text-center sm:pt-20">
        <div className="space-y-3">
          <h1 className="font-sans text-7xl uppercase leading-none tracking-[0.03em] text-[var(--color-paper-100)] sm:text-9xl">
            {settings.title}
          </h1>
          <p className="text-xl text-[var(--color-paper-200)]">{settings.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/tracks"
            className="inline-flex items-center justify-center gap-2 border border-[var(--color-line)] bg-[rgba(27,23,20,0.75)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(52,45,40,0.9)]"
          >
            Listen
          </Link>
          <RandomBeatButton beats={beats} />
        </div>
      </section>

      <section className="space-y-8">
        <div className="case-divider" />
        <SectionHeading
          eyebrow="Archive"
          title={settings.archiveHeadline}
          description={settings.archiveDescription}
        />
        <BeatGrid beats={beats} />
      </section>
    </>
  );
}