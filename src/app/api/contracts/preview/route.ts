import { NextRequest, NextResponse } from "next/server";
import { requireBuyer } from "@/lib/auth/public-guard";
import { generateAndSaveContractSnapshot } from "@/lib/contracts/preview";
import { contractPreviewRequestSchema } from "@/lib/validations/contracts";

export const runtime = "nodejs";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  const parsed = contractPreviewRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid payload.", 400);
  }

  try {
    const result = await generateAndSaveContractSnapshot(parsed.data.orderId);
    return NextResponse.json({ orderId: result.order.id, previewUrl: result.previewUrl }, { status: 200 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    console.error("[contracts/preview] failed", { orderId: parsed.data.orderId, reason });

    if (reason === "ORDER_NOT_FOUND" || reason === "BEAT_NOT_FOUND") {
      return NextResponse.json({ error: "Order not found.", code: reason }, { status: 404 });
    }
    if (reason === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized", code: reason }, { status: 401 });
    }
    if (reason === "ORDER_FINAL_PRICE_MISSING") {
      return NextResponse.json({ error: "Order price is missing for contract preview.", code: reason }, { status: 422 });
    }
    if (reason === "BUYER_EMAIL_MISSING" || reason === "BEAT_TITLE_MISSING") {
      return NextResponse.json({ error: "Required contract preview data is missing.", code: reason }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to generate contract preview.", code: reason }, { status: 500 });
  }
}
