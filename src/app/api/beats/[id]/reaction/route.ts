import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { requireBuyer } from "@/lib/auth/public-guard";

export const runtime = "nodejs";

type Reaction = "like" | "dislike";

async function reactionStats(beatId: string, userId: string | null) {
  const [grouped, mine] = await Promise.all([
    prisma.beatReaction.groupBy({ by: ["reaction"], where: { beatId }, _count: { _all: true } }),
    userId
      ? prisma.beatReaction.findUnique({
          where: { beatId_userId: { beatId, userId } },
          select: { reaction: true },
        })
      : Promise.resolve(null),
  ]);

  const count = (r: Reaction) => grouped.find((g) => g.reaction === r)?._count._all ?? 0;
  return { likes: count("like"), dislikes: count("dislike"), userReaction: (mine?.reaction as Reaction | undefined) ?? null };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getPublicSessionState();
  return NextResponse.json(await reactionStats(id, session.userId));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { reaction?: Reaction } | null;
  if (body?.reaction !== "like" && body?.reaction !== "dislike") {
    return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });
  }

  const beat = await prisma.beat.findUnique({ where: { id }, select: { id: true } });
  if (!beat) return NextResponse.json({ error: "Beat not found." }, { status: 404 });

  await prisma.beatReaction.upsert({
    where: { beatId_userId: { beatId: id, userId: guard.context.userId } },
    create: { beatId: id, userId: guard.context.userId, userEmail: guard.context.email, reaction: body.reaction },
    update: { reaction: body.reaction, userEmail: guard.context.email },
  });

  return NextResponse.json(await reactionStats(id, guard.context.userId));
}
