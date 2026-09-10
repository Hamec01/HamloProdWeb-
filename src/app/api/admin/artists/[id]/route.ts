import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminMutation } from "@/lib/auth/guard";
import { artistFormSchema } from "@/lib/validations/artist";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;

  const parsed = artistFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const { id } = await params;
  const v = parsed.data;
  try {
    await prisma.artist.update({
      where: { id },
      data: {
        artistName: v.artistName,
        trackTitle: v.trackTitle,
        beatTitle: v.beatTitle,
        coverPalette: v.coverPalette,
        spotifyUrl: v.spotifyUrl,
        appleMusicUrl: v.appleMusicUrl,
        youtubeUrl: v.youtubeUrl,
      },
    });
  } catch {
    return NextResponse.json({ error: "Artist not found." }, { status: 404 });
  }

  revalidatePath("/artists");
  revalidatePath("/admin/artists");
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  await prisma.artist.deleteMany({ where: { id } });

  revalidatePath("/artists");
  revalidatePath("/admin/artists");
  return NextResponse.json({ ok: true });
}
