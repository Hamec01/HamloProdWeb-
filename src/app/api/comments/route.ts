import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireBuyer } from "@/lib/auth/public-guard";

export const runtime = "nodejs";

const ENTITIES = ["release", "artist_post", "beat", "track"] as const;

const createSchema = z.object({
  entity: z.enum(ENTITIES),
  contentId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(60).default("Слушатель"),
  body: z.string().trim().min(1).max(1000),
  stars: z.number().int().min(1).max(5).optional().nullable(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity");
  const contentId = searchParams.get("contentId");

  if (!entity || !contentId || !(ENTITIES as readonly string[]).includes(entity)) {
    return NextResponse.json({ error: "entity and contentId required" }, { status: 400 });
  }

  const rows = await prisma.comment.findMany({
    where: { entity, contentId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, entity: true, contentId: true, authorId: true, displayName: true, body: true, stars: true, createdAt: true },
  });

  return NextResponse.json({
    comments: rows.map((c) => ({
      id: c.id,
      entity: c.entity,
      content_id: c.contentId,
      author_id: c.authorId,
      display_name: c.displayName,
      body: c.body,
      stars: c.stars,
      created_at: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const { entity, contentId, displayName, body, stars } = parsed.data;

  const created = await prisma.comment.create({
    data: { entity, contentId, authorId: guard.context.userId, displayName, body, stars: stars ?? null },
    select: { id: true, entity: true, contentId: true, authorId: true, displayName: true, body: true, stars: true, createdAt: true },
  });

  return NextResponse.json({
    ok: true,
    comment: {
      id: created.id,
      entity: created.entity,
      content_id: created.contentId,
      author_id: created.authorId,
      display_name: created.displayName,
      body: created.body,
      stars: created.stars,
      created_at: created.createdAt.toISOString(),
    },
  });
}
