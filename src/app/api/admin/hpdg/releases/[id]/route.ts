import { NextResponse } from "next/server";
import { requireHpdgAdmin } from "@/lib/hpdg/admin-guard";
import { listReleases, makeReleaseCurrent } from "@/lib/hpdg/postgres";
import { isUuid } from "@/lib/storage/keys";

export const runtime = "nodejs";

/** Make this release the one the plugin sees (also the rollback path). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHpdgAdmin(request);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    await makeReleaseCurrent(id);
    return NextResponse.json({ releases: await listReleases() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Release not found." }, { status: 404 });
  }
}
