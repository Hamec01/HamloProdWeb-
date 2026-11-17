import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBuyer } from "@/lib/auth/public-guard";
import { getLocale } from "@/lib/i18n-server";
import { createBeatInquiry } from "@/lib/orders/inquiries";
import { orderError } from "@/lib/orders/access";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const input = z.object({ reserve: z.boolean().optional().default(false) }).strict().safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !input.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try { return NextResponse.json(await createBeatInquiry(id, guard.context, await getLocale(), input.data.reserve), { status: 201, headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return orderError(error); }
}
