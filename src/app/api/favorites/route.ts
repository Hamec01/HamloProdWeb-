import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { requireBuyer } from "@/lib/auth/public-guard";

export const runtime = "nodejs";

const mutateSchema = z.object({ trackId: z.string().uuid(), isFavorite: z.boolean() });

export async function GET() {
  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ favorites: [], isAuthenticated: false });
  }

  const rows = await prisma.favorite.findMany({
    where: { userId: session.userId },
    select: { trackId: true },
  });
  return NextResponse.json({ favorites: rows.map((r) => r.trackId), isAuthenticated: true });
}

export async function POST(request: Request) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  const parsed = mutateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { trackId, isFavorite } = parsed.data;

  if (isFavorite) {
    const track = await prisma.track.findUnique({ where: { id: trackId }, select: { id: true } });
    if (!track) return NextResponse.json({ error: "Track not found." }, { status: 404 });
    await prisma.favorite.upsert({
      where: { userId_trackId: { userId: guard.context.userId, trackId } },
      create: { userId: guard.context.userId, trackId },
      update: {},
    });
  } else {
    await prisma.favorite.deleteMany({ where: { userId: guard.context.userId, trackId } });
  }

  return NextResponse.json({ ok: true });
}
