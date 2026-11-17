import { NextResponse } from "next/server";
import { requireBuyer } from "@/lib/auth/public-guard";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;
  return NextResponse.json({ error: "Оформите заявку на покупку. Поинты начисляются после подтверждения оплаты.", code: "ORDER_REQUIRED" }, { status: 409 });
}
