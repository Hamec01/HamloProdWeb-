import { TrackGrid } from "@/components/tracks/track-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { getTracks } from "@/services/content";

export default async function TracksPage() {
  const tracks = await getTracks();

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow="Tracks"
        title="HaM Releases"
        description="Release cards are ready to switch from typed mock data to Supabase-backed track entries."
      />
      <TrackGrid tracks={tracks} />
    </section>
  );
}