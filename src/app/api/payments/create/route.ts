import { NextRequest, NextResponse } from "next/server";
import { requireBuyer } from "@/lib/auth/public-guard";
import { preparePaymentCreation } from "@/lib/payments/create";
import { paymentCreateRequestSchema } from "@/lib/validations/payments";

export const runtime = "nodejs";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  const parsed = paymentCreateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid payload.", 400);
  }

  try {
    const result = await preparePaymentCreation(parsed.data.orderId);
    return NextResponse.json(
      {
        orderId: result.orderId,
        kind: result.kind,
        status: result.status,
        payment_url: result.paymentUrl,
        paymentUrl: result.paymentUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (reason === "ORDER_PRICE_CHANGED") return err("Цена изменилась. Вернитесь к оформлению заказа и проверьте договор / Price changed. Please review checkout again.", 409);
    if (reason === "ORDER_NOT_FOUND") return err("Order not found.", 404);
    if (reason === "ORDER_NOT_DRAFT") return err("Only draft orders can start payment.", 409);
    if (reason === "CONTRACT_SNAPSHOT_MISSING") return err("Contract snapshot is missing.", 409);
    if (reason === "CHECKOUT_ACCEPTANCE_MISSING") return err("Checkout terms must be accepted again before payment.", 409);
    if (reason === "MARKET_NOT_SUPPORTED") return err("Market is not supported for online checkout.", 409);
    if (reason === "PROVIDER_NOT_SUPPORTED") return err("Order payment provider does not match the selected market.", 409);
    if (reason === "UNAUTHORIZED") return err("Unauthorized", 401);
    if (reason === "LAVA_NOT_CONFIGURED" || reason === "STRIPE_NOT_CONFIGURED") return err("Payment provider is not configured on the server.", 503);
    if (reason === "LAVA_REQUEST_FAILED" || reason === "LAVA_RESPONSE_INVALID" || reason === "STRIPE_REQUEST_FAILED") return err("Failed to create payment.", 502);
    if (reason === "FREE_ORDER_FINALIZATION_FAILED") return err("Beat is no longer available or the order changed.", 409);
    return err("Failed to prepare payment.", 500);
  }
}
