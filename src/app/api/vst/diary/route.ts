import { NextResponse } from "next/server";
import { getAdminSessionState } from "@/lib/auth/session";
import { getDiaryPosts } from "@/lib/diary/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") === "ru" ? "ru" : "en";
  try {
    const session = await getAdminSessionState();
    return NextResponse.json({ posts: await getDiaryPosts(locale, session.isAuthenticated), canEdit: session.isAuthenticated }, { headers });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить дневник. Попробуй ещё раз." }, { status: 503, headers });
  }
}
