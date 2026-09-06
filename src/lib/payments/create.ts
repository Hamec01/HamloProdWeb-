import { getPublicSessionState } from "@/lib/auth/public-session";
import { resolveOrderBasePrice, resolveOrderCurrency, resolveOrderFinalPrice } from "@/lib/orders/pricing";
import { createLavaInvoice } from "@/lib/payments/lava";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PaymentOrderRow = {
  id: string;
  beat_id: string;
  buyer_user_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  buyer_city: string | null;
  base_price: number | null;
  base_price_usd: number | null;
  discount_percent: number;
  final_price: number | null;
  final_price_usd: number | null;
  status: "draft" | "pending_payment" | "paid" | "cancelled" | "failed" | "refunded" | "pending_free_checkout";
  payment_provider: string | null;
  payment_external_id: string | null;
  market: string | null;
  currency: string | null;
  provider: string | null;
  license_type: "basic" | "exclusive";
  contract_language: "ru" | "en";
};

type BeatPaymentRow = {
  id: string;
  title: string;
  slug: string;
  price_rub: number | null;
  price_usd: number;
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

function recalculateFinalAmount(basePrice: number, discountPercent: number) {
  return Math.max(0, Math.round((basePrice * (100 - clampDiscountPercent(discountPercent))) / 100));
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
      "id, beat_id, buyer_user_id, buyer_email, buyer_name, buyer_city, base_price, base_price_usd, discount_percent, final_price, final_price_usd, status, payment_provider, payment_external_id, market, currency, provider, license_type, contract_language",
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
      .select("id, title, slug, price_rub, price_usd")
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

async function persistRecalculatedOrderAmount(orderId: string, basePrice: number, finalPrice: number, currency: string) {
  const { supabase } = await getPaymentContext();

  const { error } = await supabase
    .from("orders")
    .update({
      base_price: basePrice,
      final_price: finalPrice,
      base_price_usd: basePrice,
      final_price_usd: finalPrice,
      currency,
    })
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
      provider: "internal",
      payment_external_id: null,
      payment_url: null,
    })
    .eq("id", orderId);

  if (error) {
    throw new Error("ORDER_UPDATE_FAILED");
  }
}

async function markPaidOrderPending(orderId: string, externalId: string | null, paymentUrl: string) {
  const { supabase } = await getPaymentContext();

  const { error } = await supabase
    .from("orders")
    .update({
      status: "pending_payment",
      payment_provider: "lava",
      provider: "lava",
      payment_external_id: externalId,
      payment_url: paymentUrl,
    })
    .eq("id", orderId);

  if (error) {
    throw new Error("ORDER_UPDATE_FAILED");
  }
}

async function createLavaPayment(order: PaymentOrderRow, beat: BeatPaymentRow): Promise<LavaPaymentDraft> {
  const apiBaseUrl = process.env.LAVA_API_BASE_URL?.trim();
  const apiKey = process.env.LAVA_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("LAVA_NOT_CONFIGURED");
  }

  const lava = await createLavaInvoice({
    apiBaseUrl,
    apiKey,
    payload: {
      amount: resolveOrderFinalPrice(order),
      currency: "RUB",
      description: `Beat purchase: ${beat.title}`,
      external_id: order.id,
      success_url: "https://hamloprod.org/payment/success",
      fail_url: "https://hamloprod.org/payment/fail",
    },
  });

  if (!lava.ok) {
    console.error("[lava] invoice create failed", {
      httpStatus: lava.httpStatus,
      payload: lava.payload,
      orderId: order.id,
    });
    throw new Error("LAVA_REQUEST_FAILED");
  }

  return {
    paymentUrl: lava.paymentUrl,
    externalId: lava.externalId,
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

  if (order.market !== "ru") {
    throw new Error("MARKET_NOT_SUPPORTED");
  }

  if (order.provider !== "lava") {
    throw new Error("PROVIDER_NOT_SUPPORTED");
  }

  const currentBasePrice = resolveOrderBasePrice(order);
  const currentFinalPrice = resolveOrderFinalPrice(order);
  const currentCurrency = resolveOrderCurrency(order);
  const marketBasePrice = beat.price_rub ?? currentBasePrice;
  const recalculatedFinalAmount = recalculateFinalAmount(marketBasePrice, order.discount_percent);

  if (marketBasePrice !== currentBasePrice || recalculatedFinalAmount !== currentFinalPrice || currentCurrency !== "RUB") {
    await persistRecalculatedOrderAmount(order.id, marketBasePrice, recalculatedFinalAmount, "RUB");
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
      final_price: recalculatedFinalAmount,
      final_price_usd: recalculatedFinalAmount,
    },
    beat,
  );

  await markPaidOrderPending(order.id, lavaPayment.externalId, lavaPayment.paymentUrl);

  return {
    kind: "paid",
    orderId: order.id,
    status: "pending_payment",
    paymentUrl: lavaPayment.paymentUrl,
  };
}