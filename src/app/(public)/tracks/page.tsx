import { TrackGrid } from "@/components/tracks/track-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/session";
import { getTracks } from "@/services/content";

export default async function TracksPage() {
  const [tracks, session] = await Promise.all([getTracks(), getPublicSessionState()]);

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow="Tracks"
        title="HaM Releases"
        description="Release cards are ready to switch from typed mock data to Supabase-backed track entries."
      />
      <TrackGrid tracks={tracks} isAuthenticated={session.isAuthenticated} />
    </section>
  );
}