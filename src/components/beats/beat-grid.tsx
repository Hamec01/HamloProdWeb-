import { BeatCard } from "@/components/beats/beat-card";
import { type Locale } from "@/lib/i18n";
import type { Beat } from "@/types";
import type { BeatReactionStats } from "@/lib/beats/pagination";
import { prisma } from "@/lib/db/client";
import { beatStripeAvailability } from "@/lib/checkout/stripe-availability";
import { isBeatStripeReady } from "@/lib/checkout/config";

export async function BeatGrid({
  beats,
  locale,
  hrefBase = "/beats",
  isAuthenticated,
  reactions,
}: {
  beats: Beat[];
  locale: Locale;
  hrefBase?: string;
  isAuthenticated: boolean;
  reactions?: Record<string, BeatReactionStats>;
}) {
  const stripeConfigured = isBeatStripeReady();
  const readyIds = stripeConfigured && beats.length ? await prisma.beat.findMany({ where: { id: { in: beats.filter((beat) => beat.priceUsd > 0).map((beat) => beat.id) }, OR: [{ archiveKey: { not: null } }, { delivery: { isNot: null } }] }, select: { id: true } }) : [];
  const stripeBeats = new Set(readyIds.map((row) => row.id));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {beats.map((beat) => (
        <BeatCard key={beat.id} beat={beat} queue={beats} locale={locale} hrefBase={hrefBase} isAuthenticated={isAuthenticated} initialReactionStats={reactions?.[beat.id]} stripeAvailable={beatStripeAvailability(stripeConfigured, beat.priceUsd, stripeBeats.has(beat.id)).available} stripeUnavailableReason={beatStripeAvailability(stripeConfigured, beat.priceUsd, stripeBeats.has(beat.id)).reason} />
      ))}
    </div>
  );
}
