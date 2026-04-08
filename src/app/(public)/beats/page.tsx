import { BeatGrid } from "@/components/beats/beat-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { getBeats } from "@/services/content";

export default async function BeatsPage() {
  const beats = await getBeats();

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow="Archive"
        title="Beat Files"
        description="Temporary mock records for development. Production content should be created through admin and loaded from Supabase tables."
      />
      <BeatGrid beats={beats} />
    </section>
  );
}