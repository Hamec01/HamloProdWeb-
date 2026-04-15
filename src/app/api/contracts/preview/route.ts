import { NextRequest, NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { generateAndSaveContractSnapshot } from "@/lib/contracts/preview";
import { contractPreviewRequestSchema } from "@/lib/validations/contracts";

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
  const parsed = contractPreviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid payload.", 400);
  }

  try {
    const result = await generateAndSaveContractSnapshot(parsed.data.orderId);
    return NextResponse.json(
      {
        orderId: result.order.id,
        previewUrl: result.previewUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (reason === "ORDER_NOT_FOUND" || reason === "BEAT_NOT_FOUND") {
      return err("Order not found.", 404);
    }

    if (reason === "UNAUTHORIZED") {
      return err("Unauthorized", 401);
    }

    return err("Failed to generate contract preview.", 500);
  }
}
