import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireBuyer } from "@/lib/auth/public-guard";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  await prisma.comment.deleteMany({ where: { id, authorId: guard.context.userId } });
  return NextResponse.json({ ok: true });
}
