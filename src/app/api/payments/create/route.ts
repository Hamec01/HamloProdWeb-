import { NextRequest, NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/session";
import { preparePaymentCreation } from "@/lib/payments/create";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { paymentCreateRequestSchema } from "@/lib/validations/payments";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return err("Supabase not configured.", 503);
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return err("Unauthorized", 401);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = paymentCreateRequestSchema.safeParse(body);
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
        paymentUrl: result.paymentUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (reason === "ORDER_NOT_FOUND") {
      return err("Order not found.", 404);
    }

    if (reason === "ORDER_NOT_DRAFT") {
      return err("Only draft orders can start payment.", 409);
    }

    if (reason === "CONTRACT_SNAPSHOT_MISSING") {
      return err("Contract snapshot is missing.", 409);
    }

    if (reason === "MARKET_NOT_SUPPORTED") {
      return err("Lava payments are available only for RU market orders.", 409);
    }

    if (reason === "PROVIDER_NOT_SUPPORTED") {
      return err("Order payment provider must be lava.", 409);
    }

    if (reason === "UNAUTHORIZED") {
      return err("Unauthorized", 401);
    }

    if (reason === "LAVA_NOT_CONFIGURED") {
      return err("Lava payment is not configured on the server.", 503);
    }

    if (reason === "LAVA_REQUEST_FAILED" || reason === "LAVA_RESPONSE_INVALID") {
      return err("Failed to create Lava payment.", 502);
    }

    return err("Failed to prepare payment.", 500);
  }
}