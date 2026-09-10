import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { requireBuyer } from "@/lib/auth/public-guard";

export const runtime = "nodejs";

type ContentType = "beat" | "track";

function resolveContentType(entity: string): ContentType | null {
  if (entity === "beats") return "beat";
  if (entity === "tracks") return "track";
  return null;
}

export async function GET(_: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await params;
  const contentType = resolveContentType(entity);
  if (!contentType) return NextResponse.json({ error: "Unknown entity type." }, { status: 400 });

  const session = await getPublicSessionState();

  const [ratings, comments, userRating] = await Promise.all([
    prisma.contentRating.findMany({ where: { contentType, contentId: id }, select: { rating: true } }),
    prisma.contentComment.findMany({
      where: { contentType, contentId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, comment: true, userEmail: true, createdAt: true },
    }),
    session.userId
      ? prisma.contentRating.findUnique({
          where: { contentType_contentId_userId: { contentType, contentId: id, userId: session.userId } },
          select: { rating: true },
        })
      : Promise.resolve(null),
  ]);

  const ratingsCount = ratings.length;
  const averageRating = ratingsCount ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratingsCount : 0;

  return NextResponse.json({
    averageRating,
    ratingsCount,
    userRating: userRating?.rating ?? null,
    comments: comments.map((c) => ({
      id: c.id,
      comment: c.comment,
      userEmail: c.userEmail,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await params;
  const contentType = resolveContentType(entity);
  if (!contentType) return NextResponse.json({ error: "Unknown entity type." }, { status: 400 });

  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as { rating?: number; comment?: string } | null;
  const rating = body?.rating;
  const comment = body?.comment?.trim();

  if (typeof rating !== "number" && !comment) {
    return NextResponse.json({ error: "Nothing to submit." }, { status: 400 });
  }

  const target =
    contentType === "beat"
      ? await prisma.beat.findUnique({ where: { id }, select: { id: true } })
      : await prisma.track.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "Content not found." }, { status: 404 });

  if (typeof rating === "number") {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
    }
    await prisma.contentRating.upsert({
      where: { contentType_contentId_userId: { contentType, contentId: id, userId: guard.context.userId } },
      create: { contentType, contentId: id, userId: guard.context.userId, userEmail: guard.context.email, rating },
      update: { rating, userEmail: guard.context.email },
    });
  }

  if (comment) {
    if (comment.length < 2 || comment.length > 500) {
      return NextResponse.json({ error: "Comment must be between 2 and 500 characters." }, { status: 400 });
    }
    await prisma.contentComment.create({
      data: { contentType, contentId: id, userId: guard.context.userId, userEmail: guard.context.email, comment },
    });
  }

  return NextResponse.json({ ok: true });
}
