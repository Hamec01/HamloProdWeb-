import { NextRequest, NextResponse } from "next/server";
import { requireBuyer } from "@/lib/auth/public-guard";
import { isPaidCheckoutEnabled, paidCheckoutDisabledResponse } from "@/lib/checkout/config";
import { contractPdfCreateSchema } from "@/lib/validations/rights-form";
import { createRightsContractPdf } from "@/lib/contracts/pdf";

export const runtime = "nodejs";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  // Paid checkout is off → never generate a new rights PDF or mutate an order.
  if (!isPaidCheckoutEnabled()) {
    const d = paidCheckoutDisabledResponse();
    return NextResponse.json(d.body, { status: d.status });
  }

  const parsed = contractPdfCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid payload.", 400);
  }

  try {
    const result = await createRightsContractPdf(parsed.data);
    return NextResponse.json({ orderId: result.orderId, mode: result.mode, contractUrl: result.downloadUrl });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (reason === "UNAUTHORIZED") return err("Unauthorized", 401);
    if (reason === "ORDER_NOT_FOUND" || reason === "BEAT_NOT_FOUND") return err("Order not found.", 404);
    if (reason === "ORDER_NOT_READY_FOR_RIGHTS_FORM") return err("Order is not paid yet. Wait for webhook confirmation.", 409);
    if (reason === "MISSING_REQUIRED_FIELDS") return err("Full name, city and stage name are required for partial mode.", 400);
    if (reason.startsWith("SELLER_CONFIG_MISSING") || reason.startsWith("SELLER_SIGNATURE_MISSING")) {
      return err("Seller contract data is not configured on the server.", 500);
    }
    if (reason === "PDF_RENDER_FAILED") return err("Failed to render PDF.", 500);
    if (reason === "PDF_UPLOAD_FAILED" || reason === "ORDER_UPDATE_FAILED" || reason === "PDF_SIGN_URL_FAILED") {
      return err("Failed to save contract PDF.", 500);
    }
    return err("Failed to create contract PDF.", 500);
  }
}
