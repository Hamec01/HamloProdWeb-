import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { isSameOriginRequest } from "@/lib/auth/origin";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const post = await prisma.artistPost.findUnique({ where: { id }, select: { artistId: true, authorId: true } });
  if (!post) return NextResponse.json({ ok: true });

  const isAdmin = session.role === "ADMIN" || session.role === "EDITOR";
  const isOwner = session.artistId === post.artistId || session.userId === post.authorId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.artistPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
