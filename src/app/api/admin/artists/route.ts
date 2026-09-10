import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminMutation } from "@/lib/auth/guard";
import { artistFormSchema } from "@/lib/validations/artist";
import { generateSlug } from "@/lib/slug";

export const runtime = "nodejs";

async function uniqueSlug(base: string): Promise<string> {
  const root = generateSlug(base) || "artist";
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    if (!(await prisma.artist.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export async function POST(request: Request) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;

  const parsed = artistFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const v = parsed.data;
  await prisma.artist.create({
    data: {
      slug: await uniqueSlug(v.artistName),
      artistName: v.artistName,
      trackTitle: v.trackTitle,
      beatTitle: v.beatTitle,
      coverPalette: v.coverPalette,
      spotifyUrl: v.spotifyUrl,
      appleMusicUrl: v.appleMusicUrl,
      youtubeUrl: v.youtubeUrl,
    },
  });

  revalidatePath("/artists");
  revalidatePath("/admin/artists");
  return NextResponse.json({ ok: true });
}
