import { NextResponse } from "next/server";
import { getAdminSessionState } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getAdminSessionState();
  if (!session.isAuthenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) || "";
  if (q.length < 2) return NextResponse.json({ users: [] }, { headers: { "Cache-Control": "no-store" } });
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { contains: q, mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }] },
    select: { id: true, email: true, displayName: true, loyalty: { select: { points: true } } },
    orderBy: { email: "asc" }, take: 20,
  });
  return NextResponse.json({ users: users.map((user) => ({ id: user.id, email: user.email, displayName: user.displayName, points: user.loyalty?.points || 0 })) }, { headers: { "Cache-Control": "no-store" } });
}
