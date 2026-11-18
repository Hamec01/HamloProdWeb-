import { NextResponse } from "next/server";
import { z } from "zod";
import { userAdminGuard, privateHeaders, userError } from "@/lib/users/http";
import { listPointGrants, grantUserPoints } from "@/lib/users/service";
import { grantInput } from "@/lib/users/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ userId: string }> };
export async function GET(request: Request, { params }: Context) {
  const guard = await userAdminGuard(request);
  if (!guard.ok) return guard.response;
  const { userId } = await params;
  const before = new URL(request.url).searchParams.get("before") || undefined;
  if (!z.uuid().safeParse(userId).success || (before && !z.uuid().safeParse(before).success)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try { return NextResponse.json(await listPointGrants(userId, before), { headers: privateHeaders }); }
  catch (error) { return userError(error); }
}
export async function POST(request: Request, { params }: Context) {
  const guard = await userAdminGuard(request, true);
  if (!guard.ok) return guard.response;
  const { userId } = await params;
  const input = grantInput.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(userId).success || !input.success) return NextResponse.json({ error: "Проверьте заполнение полей." }, { status: 400 });
  try { return NextResponse.json(await grantUserPoints(userId, guard.adminId, input.data.amount, input.data.reason, input.data.requestId), { status: 201, headers: privateHeaders }); }
  catch (error) { return userError(error); }
}
