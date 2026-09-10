import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminMutation } from "@/lib/auth/guard";
import { releaseFormSchema } from "@/lib/validations/release";

export const runtime = "nodejs";

const asDate = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);

function revalidateReleasePages() {
  for (const p of ["/ru/ham", "/en/ham", "/admin/releases", "/tracks", "/ru/tracks", "/en/tracks"]) revalidatePath(p);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;

  const parsed = releaseFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const { id } = await params;
  const { tracks, ...r } = parsed.data;
  const releaseDate = asDate(r.releaseDate);

  const shared = {
    artistName: r.artistName,
    coverPalette: r.coverPalette,
    coverKey: r.coverImagePath,
    spotifyUrl: r.spotifyUrl,
    appleMusicUrl: r.appleMusicUrl,
    youtubeUrl: r.youtubeUrl,
    releaseDate,
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.release.update({
        where: { id },
        data: {
          title: r.title,
          slug: r.slug,
          featArtistNames: r.featArtistNames ?? "",
          releaseType: r.releaseType,
          description: r.description,
          published: r.published,
          featured: r.featured,
          ...shared,
        },
      });

      const existing = await tx.track.findMany({ where: { releaseId: id }, select: { id: true, slug: true } });
      const existingIds = new Set(existing.map((t) => t.id));
      const incomingIds = new Set(tracks.map((t) => t.id).filter((v): v is string => Boolean(v)));

      const detached = [...existingIds].filter((tid) => !incomingIds.has(tid));
      if (detached.length) {
        await tx.track.updateMany({ where: { id: { in: detached } }, data: { releaseId: null, trackNumber: null } });
      }

      for (const t of tracks) {
        const payload = { title: t.title, slug: t.slug, audioKey: t.mp3FilePath, releaseId: id, trackNumber: t.trackNumber, ...shared };

        if (t.id && existingIds.has(t.id)) {
          await tx.track.update({ where: { id: t.id }, data: payload });
          continue;
        }

        const bySlug = await tx.track.findUnique({ where: { slug: t.slug }, select: { id: true, releaseId: true } });
        if (bySlug) {
          if (bySlug.releaseId && bySlug.releaseId !== id) {
            throw new Error(`SLUG_IN_USE:${t.slug}`);
          }
          await tx.track.update({ where: { id: bySlug.id }, data: payload });
          continue;
        }

        await tx.track.create({ data: payload });
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.startsWith("SLUG_IN_USE:")) {
      return NextResponse.json({ error: `Track slug "${msg.slice(12)}" is already used by another release.` }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update release." }, { status: 500 });
  }

  revalidateReleasePages();
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  await prisma.$transaction(async (tx) => {
    await tx.track.updateMany({ where: { releaseId: id }, data: { releaseId: null, trackNumber: null } });
    await tx.release.deleteMany({ where: { id } });
  });

  revalidateReleasePages();
  return NextResponse.json({ success: true });
}
