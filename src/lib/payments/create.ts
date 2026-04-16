import { getPublicSessionState } from "@/lib/auth/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PaymentOrderRow = {
  id: string;
  beat_id: string;
  buyer_user_id: string | null;
  buyer_email: string;
  base_price_usd: number;
  discount_percent: number;
  final_price_usd: number;
  status: "draft" | "pending_payment" | "paid" | "cancelled" | "failed" | "refunded" | "pending_free_checkout";
  payment_provider: string | null;
  payment_external_id: string | null;
  license_type: "basic" | "exclusive";
  contract_language: "ru" | "en";
};

type BeatPaymentRow = {
  id: string;
  title: string;
  slug: string;
};

type ContractPaymentRow = {
  id: string;
  html_snapshot: string;
};

type LavaPaymentDraft = {
  paymentUrl: string;
  externalId: string | null;
};

type FreeOrderResult = {
  kind: "free";
  orderId: string;
  status: "pending_free_checkout";
  paymentUrl: null;
};

type PaidOrderResult = {
  kind: "paid";
  orderId: string;
  status: "pending_payment";
  paymentUrl: string;
};

export type PaymentPreparationResult = FreeOrderResult | PaidOrderResult;

function parseContractPaymentRow(value: Record<string, unknown> | null | undefined): ContractPaymentRow | null {
  if (!value || typeof value.id !== "string") {
    return null;
  }

  return {
    id: value.id,
    html_snapshot: typeof value.html_snapshot === "string" ? value.html_snapshot : "",
  };
}

function clampDiscountPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function recalculateFinalAmount(basePriceUsd: number, discountPercent: number) {
  return Math.max(0, Math.round((basePriceUsd * (100 - clampDiscountPercent(discountPercent))) / 100));
}

async function getPaymentContext() {
  if (!hasSupabaseEnv()) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    throw new Error("UNAUTHORIZED");
  }

  const supabase = await createSupabaseServerClient();

  return {
    supabase,
    userId: session.userId,
  };
}

export async function getOrderForPayment(orderId: string) {
  const { supabase, userId } = await getPaymentContext();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, beat_id, buyer_user_id, buyer_email, base_price_usd, discount_percent, final_price_usd, status, payment_provider, payment_external_id, license_type, contract_language",
    )
    .eq("id", orderId)
    .eq("buyer_user_id", userId)
    .maybeSingle<PaymentOrderRow>();

  if (orderError || !order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const [{ data: beat, error: beatError }, { data: contract, error: contractError }] = await Promise.all([
    supabase
      .from("beats")
      .select("id, title, slug")
      .eq("id", order.beat_id)
      .maybeSingle<BeatPaymentRow>(),
    supabase
      .from("contracts")
      .select()
      .eq("order_id", orderId)
      .maybeSingle(),
  ]);

  if (beatError || !beat) {
    throw new Error("BEAT_NOT_FOUND");
  }

  const parsedContract = parseContractPaymentRow(contract as Record<string, unknown> | null | undefined);

  if (contractError) {
    throw new Error("CONTRACT_LOOKUP_FAILED");
  }

  return {
    order,
    beat,
    contract: parsedContract,
    contractSnapshotExists: Boolean(parsedContract?.html_snapshot?.trim()),
  };
}

async function persistRecalculatedOrderAmount(orderId: string, finalPriceUsd: number) {
  const { supabase } = await getPaymentContext();

  const { error } = await supabase
    .from("orders")
    .update({ final_price_usd: finalPriceUsd })
    .eq("id", orderId);

  if (error) {
    throw new Error("ORDER_UPDATE_FAILED");
  }
}

async function markFreeOrderPending(orderId: string) {
  const { supabase } = await getPaymentContext();

  const { error } = await supabase
    .from("orders")
    .update({
      status: "pending_free_checkout",
      payment_provider: "internal",
      payment_external_id: null,
    })
    .eq("id", orderId);

  if (error) {
    throw new Error("ORDER_UPDATE_FAILED");
  }
}

async function markPaidOrderPending(orderId: string, externalId: string | null) {
  const { supabase } = await getPaymentContext();

  const { error } = await supabase
    .from("orders")
    .update({
      status: "pending_payment",
      payment_provider: "lava",
      payment_external_id: externalId,
    })
    .eq("id", orderId);

  if (error) {
    throw new Error("ORDER_UPDATE_FAILED");
  }
}

async function createLavaPayment(order: PaymentOrderRow, beat: BeatPaymentRow): Promise<LavaPaymentDraft> {
  const apiUrl = process.env.LAVA_API_URL?.trim();
  const apiKey = process.env.LAVA_API_KEY?.trim();
  const returnBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!apiUrl || !apiKey || !returnBaseUrl) {
    throw new Error("LAVA_NOT_CONFIGURED");
  }

  const successUrl = `${returnBaseUrl}/profile`;
  const failUrl = `${returnBaseUrl}/checkout/payment/${order.id}`;

  // TODO: Align endpoint, headers, auth scheme, and payload fields with the real Lava API contract.
  // TODO: Replace placeholder metadata field names below with the exact Lava payload once confirmed.
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      orderId: order.id,
      amount: order.final_price_usd,
      currency: "USD",
      description: `HamloProd license for ${beat.title}`,
      customerEmail: order.buyer_email,
      successUrl,
      failUrl,
      metadata: {
        beatId: beat.id,
        licenseType: order.license_type,
        contractLanguage: order.contract_language,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("LAVA_REQUEST_FAILED");
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const paymentUrl =
    typeof payload?.paymentUrl === "string"
      ? payload.paymentUrl
      : typeof payload?.payment_url === "string"
        ? payload.payment_url
        : typeof payload?.url === "string"
          ? payload.url
          : null;
  const externalId =
    typeof payload?.id === "string"
      ? payload.id
      : typeof payload?.invoiceId === "string"
        ? payload.invoiceId
        : typeof payload?.invoice_id === "string"
          ? payload.invoice_id
          : null;

  if (!paymentUrl) {
    throw new Error("LAVA_RESPONSE_INVALID");
  }

  return {
    paymentUrl,
    externalId,
  };
}

export async function preparePaymentCreation(orderId: string): Promise<PaymentPreparationResult> {
  const { order, beat, contractSnapshotExists } = await getOrderForPayment(orderId);

  if (order.status !== "draft") {
    throw new Error("ORDER_NOT_DRAFT");
  }

  if (!contractSnapshotExists) {
    throw new Error("CONTRACT_SNAPSHOT_MISSING");
  }

  const recalculatedFinalAmount = recalculateFinalAmount(order.base_price_usd, order.discount_percent);
  if (recalculatedFinalAmount !== order.final_price_usd) {
    await persistRecalculatedOrderAmount(order.id, recalculatedFinalAmount);
  }

  if (recalculatedFinalAmount === 0) {
    await markFreeOrderPending(order.id);

    return {
      kind: "free",
      orderId: order.id,
      status: "pending_free_checkout",
      paymentUrl: null,
    };
  }

  const lavaPayment = await createLavaPayment(
    {
      ...order,
      final_price_usd: recalculatedFinalAmount,
    },
    beat,
  );

  await markPaidOrderPending(order.id, lavaPayment.externalId);

  return {
    kind: "paid",
    orderId: order.id,
    status: "pending_payment",
    paymentUrl: lavaPayment.paymentUrl,
  };
}