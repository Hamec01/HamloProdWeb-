import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

const createSchema = z.object({
  entity: z.enum(["release", "artist_post", "beat", "track"]),
  contentId: z.string().uuid(),
  displayName: z.string().min(1).max(60).default("Слушатель"),
  body: z.string().min(1).max(1000),
  stars: z.number().int().min(1).max(5).optional().nullable(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity") as "release" | "artist_post" | "beat" | "track" | null;
  const contentId = searchParams.get("contentId");

  if (!entity || !contentId) {
    return NextResponse.json({ error: "entity and contentId required" }, { status: 400 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ comments: [] });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, entity, content_id, author_id, display_name, body, stars, created_at")
    .eq("entity", entity)
    .eq("content_id", contentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const { entity, contentId, displayName, body, stars } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      entity,
      content_id: contentId,
      author_id: session.userId,
      display_name: displayName,
      body,
      stars: stars ?? null,
    })
    .select("id, entity, content_id, author_id, display_name, body, stars, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, comment: data });
}
