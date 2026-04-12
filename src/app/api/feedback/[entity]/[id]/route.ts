import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ContentType = "beat" | "track";

function resolveContentType(entity: string): ContentType | null {
  if (entity === "beats") {
    return "beat";
  }
  if (entity === "tracks") {
    return "track";
  }
  return null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ averageRating: 0, ratingsCount: 0, userRating: null, comments: [] });
  }

  const { entity, id } = await params;
  const contentType = resolveContentType(entity);

  if (!contentType) {
    return errorResponse("Unknown entity type.", 400);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [ratingsResult, commentsResult, userRatingResult] = await Promise.all([
    supabase.from("content_ratings").select("rating").eq("content_type", contentType).eq("content_id", id),
    supabase
      .from("content_comments")
      .select("id, comment, user_email, created_at")
      .eq("content_type", contentType)
      .eq("content_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    user
      ? supabase
          .from("content_ratings")
          .select("rating")
          .eq("content_type", contentType)
          .eq("content_id", id)
          .eq("user_id", user.id)
          .maybeSingle<{ rating: number }>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const ratings = ratingsResult.data ?? [];
  const ratingsCount = ratings.length;
  const averageRating = ratingsCount ? ratings.reduce((sum, item) => sum + item.rating, 0) / ratingsCount : 0;

  return NextResponse.json({
    averageRating,
    ratingsCount,
    userRating: userRatingResult.data?.rating ?? null,
    comments:
      commentsResult.data?.map((comment) => ({
        id: comment.id,
        comment: comment.comment,
        userEmail: comment.user_email,
        createdAt: comment.created_at,
      })) ?? [],
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  if (!hasSupabaseEnv()) {
    return errorResponse("Supabase env is not configured.", 503);
  }

  const { entity, id } = await params;
  const contentType = resolveContentType(entity);

  if (!contentType) {
    return errorResponse("Unknown entity type.", 400);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Login required.", 401);
  }

  const body = (await request.json().catch(() => null)) as { rating?: number; comment?: string } | null;
  const rating = body?.rating;
  const comment = body?.comment?.trim();

  if (typeof rating !== "number" && !comment) {
    return errorResponse("Nothing to submit.", 400);
  }

  if (typeof rating === "number") {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return errorResponse("Rating must be between 1 and 5.", 400);
    }

    const { error: upsertError } = await supabase.from("content_ratings").upsert(
      {
        content_type: contentType,
        content_id: id,
        user_id: user.id,
        user_email: user.email ?? "unknown",
        rating,
      },
      { onConflict: "content_type,content_id,user_id" },
    );

    if (upsertError) {
      return errorResponse(upsertError.message, 400);
    }
  }

  if (comment) {
    if (comment.length < 2 || comment.length > 500) {
      return errorResponse("Comment must be between 2 and 500 characters.", 400);
    }

    const { error: commentError } = await supabase.from("content_comments").insert({
      content_type: contentType,
      content_id: id,
      user_id: user.id,
      user_email: user.email ?? "unknown",
      comment,
    });

    if (commentError) {
      return errorResponse(commentError.message, 400);
    }
  }

  return NextResponse.json({ ok: true });
}