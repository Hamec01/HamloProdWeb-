import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminMutation } from "@/lib/auth/guard";
import { trackFormSchema } from "@/lib/validations/track";

export const runtime = "nodejs";

function revalidateTrackPages() {
  for (const p of ["/tracks", "/ru/tracks", "/en/tracks", "/ru/ham", "/en/ham", "/admin/tracks"]) revalidatePath(p);
}

export async function POST(request: Request) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;

  const parsed = trackFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const v = parsed.data;
  const created = await prisma.track.create({
    data: {
      title: v.title,
      slug: v.slug,
      artistName: v.artistName,
      coverPalette: v.coverPalette,
      coverKey: v.coverImagePath,
      audioKey: v.mp3FilePath,
      spotifyUrl: v.spotifyUrl,
      appleMusicUrl: v.appleMusicUrl,
      youtubeUrl: v.youtubeUrl,
      releaseDate: new Date(`${v.releaseDate}T00:00:00.000Z`),
      isDemo: v.isDemo,
    },
    select: { id: true },
  });

  revalidateTrackPages();
  return NextResponse.json({ ok: true, id: created.id });
}
