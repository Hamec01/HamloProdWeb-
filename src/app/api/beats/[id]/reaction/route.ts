import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Reaction = "like" | "dislike";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getReactionStats(beatId: string, userId: string | null) {
  const supabase = await createSupabaseServerClient();

  const [countsResult, userResult] = await Promise.all([
    supabase.from("beat_reactions").select("reaction").eq("beat_id", beatId),
    userId
      ? supabase
          .from("beat_reactions")
          .select("reaction")
          .eq("beat_id", beatId)
          .eq("user_id", userId)
          .maybeSingle<{ reaction: Reaction }>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const rows = countsResult.data ?? [];
  const likes = rows.filter((item) => item.reaction === "like").length;
  const dislikes = rows.filter((item) => item.reaction === "dislike").length;

  return {
    likes,
    dislikes,
    userReaction: userResult.data?.reaction ?? null,
  };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ likes: 0, dislikes: 0, userReaction: null });
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stats = await getReactionStats(id, user?.id ?? null);
  return NextResponse.json(stats);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) {
    return errorResponse("Supabase env is not configured.", 503);
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Login required.", 401);
  }

  const body = (await request.json().catch(() => null)) as { reaction?: Reaction } | null;
  if (body?.reaction !== "like" && body?.reaction !== "dislike") {
    return errorResponse("Invalid reaction.", 400);
  }

  const { error } = await supabase.from("beat_reactions").upsert(
    {
      beat_id: id,
      user_id: user.id,
      user_email: user.email ?? "unknown",
      reaction: body.reaction,
    },
    { onConflict: "beat_id,user_id" },
  );

  if (error) {
    return errorResponse(error.message, 400);
  }

  const stats = await getReactionStats(id, user.id);
  return NextResponse.json(stats);
}
