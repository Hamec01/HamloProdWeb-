import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminMutation } from "@/lib/auth/guard";
import { releaseFormSchema } from "@/lib/validations/release";

export const runtime = "nodejs";

const asDate = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);

export async function POST(request: Request) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;

  const parsed = releaseFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const { tracks, ...r } = parsed.data;
  const releaseDate = asDate(r.releaseDate);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const release = await tx.release.create({
        data: {
          title: r.title,
          slug: r.slug,
          artistName: r.artistName,
          featArtistNames: r.featArtistNames ?? "",
          releaseType: r.releaseType,
          coverPalette: r.coverPalette,
          coverKey: r.coverImagePath,
          description: r.description,
          spotifyUrl: r.spotifyUrl,
          appleMusicUrl: r.appleMusicUrl,
          youtubeUrl: r.youtubeUrl,
          releaseDate,
          published: r.published,
          featured: r.featured,
        },
        select: { id: true },
      });

      if (tracks.length > 0) {
        await tx.track.createMany({
          data: tracks.map((t) => ({
            title: t.title,
            slug: t.slug,
            artistName: r.artistName,
            coverPalette: r.coverPalette,
            coverKey: r.coverImagePath,
            audioKey: t.mp3FilePath,
            spotifyUrl: r.spotifyUrl,
            appleMusicUrl: r.appleMusicUrl,
            youtubeUrl: r.youtubeUrl,
            releaseDate,
            releaseId: release.id,
            trackNumber: t.trackNumber,
          })),
        });
      }

      return release;
    });

    for (const p of ["/ru/ham", "/en/ham", "/admin/releases", "/tracks", "/ru/tracks", "/en/tracks"]) revalidatePath(p);
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && /Unique constraint/.test(error.message) ? "A release or track slug is already in use." : "Failed to create release.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
