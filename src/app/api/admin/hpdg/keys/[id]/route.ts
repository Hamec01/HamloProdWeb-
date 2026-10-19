import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHpdgAdmin } from "@/lib/hpdg/admin-guard";
import { listLicenseKeys, setLicenseKeyRevoked } from "@/lib/hpdg/postgres";
import { isUuid } from "@/lib/storage/keys";

export const runtime = "nodejs";

const schema = z.object({ revoked: z.boolean(), reason: z.string().trim().max(500).nullish() });

/** Revoke (refund, leak) or restore a key. Keys are never deleted: downloads stay in the log. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHpdgAdmin(request);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  try {
    await setLicenseKeyRevoked(id, parsed.data.revoked, parsed.data.reason ?? null);
    return NextResponse.json({ keys: await listLicenseKeys() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Key not found." }, { status: 404 });
  }
}
