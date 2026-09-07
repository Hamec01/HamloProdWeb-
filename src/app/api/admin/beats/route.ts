import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionState } from "@/lib/auth/session";
import { requireAdminMutation } from "@/lib/auth/guard";
import { BeatService } from "@/lib/beats/service";
import type { BeatStatus } from "@/types/beat";
import { BEAT_STATUS_VALUES } from "@/lib/validations/beat";

export const runtime = "nodejs";

const service = new BeatService();

function noStore(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function revalidateBeatPaths(slug?: string) {
  for (const path of ["/", "/beats", "/admin/beats", "/ru/beats", "/en/beats"]) {
    revalidatePath(path);
  }
  if (slug) {
    for (const path of [`/beats/${slug}`, `/checkout/${slug}`, `/ru/beats/${slug}`, `/en/beats/${slug}`]) {
      revalidatePath(path);
    }
  }
}

export async function GET(request: Request) {
  let session;
  try {
    session = await getAdminSessionState();
  } catch {
    return noStore({ error: "Authentication is not available." }, 503);
  }
  if (!session.isAuthenticated) {
    return noStore({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const featuredParam = url.searchParams.get("featured");

  const result = await service.listAdmin({
    limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
    offset: url.searchParams.has("offset") ? Number(url.searchParams.get("offset")) : undefined,
    status: statusParam && (BEAT_STATUS_VALUES as readonly string[]).includes(statusParam) ? (statusParam as BeatStatus) : undefined,
    featured: featuredParam === null ? undefined : featuredParam === "true",
  });

  return noStore(result);
}

export async function POST(request: Request) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Invalid JSON body." }, 400);
  }

  const result = await service.create(body, guard.context.role);

  if (!result.ok) {
    return noStore({ error: result.error, code: result.code }, result.status);
  }

  revalidateBeatPaths(result.data.slug);
  return noStore({ beat: result.data }, 201);
}
