import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionState } from "@/lib/auth/session";
import { requireAdminMutation } from "@/lib/auth/guard";
import { BeatService } from "@/lib/beats/service";

export const runtime = "nodejs";

const service = new BeatService();

function noStore(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function revalidateBeatPaths(...slugs: Array<string | null | undefined>) {
  for (const path of ["/", "/beats", "/admin/beats", "/ru/beats", "/en/beats"]) {
    revalidatePath(path);
  }
  for (const slug of slugs) {
    if (!slug) continue;
    for (const path of [`/beats/${slug}`, `/checkout/${slug}`, `/ru/beats/${slug}`, `/en/beats/${slug}`]) {
      revalidatePath(path);
    }
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await getAdminSessionState();
  } catch {
    return noStore({ error: "Authentication is not available." }, 503);
  }
  if (!session.isAuthenticated) {
    return noStore({ error: "Unauthorized" }, 401);
  }

  const { id } = await params;
  const beat = await service.getAdminById(id);
  return beat ? noStore({ beat }) : noStore({ error: "Beat not found." }, 404);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const before = await service.getAdminById(id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Invalid JSON body." }, 400);
  }

  const result = await service.update(id, body, guard.context.role);

  if (!result.ok) {
    return noStore({ error: result.error, code: result.code }, result.status);
  }

  revalidateBeatPaths(before?.slug, result.data.slug);
  return noStore({ beat: result.data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const before = await service.getAdminById(id);
  const result = await service.delete(id, guard.context.role);

  if (!result.ok) {
    return noStore({ error: result.error, code: result.code }, result.status);
  }

  revalidateBeatPaths(before?.slug);
  return noStore({ ok: true });
}
