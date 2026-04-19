import { createHmac, timingSafeEqual } from "node:crypto";

type LavaInvoiceCreateRequest = {
  amount: number;
  currency: "RUB";
  description: string;
  external_id: string;
  success_url: string;
  fail_url: string;
};

type LavaInvoiceCreateResponse = {
  id?: string | number;
  url?: string;
  payment_url?: string;
  invoice_url?: string;
  status?: string | number;
  data?: {
    id?: string | number;
    url?: string;
    payment_url?: string;
    invoice_url?: string;
    pay_url?: string;
    amount?: number;
    status?: string | number;
  };
  error?: unknown;
  message?: string;
};

export type LavaWebhookPayload = {
  invoice_id?: string;
  order_id?: string;
  status?: string;
  pay_time?: string;
  amount?: number;
  custom_fields?: string | null;
  credited?: number;
} & Record<string, unknown>;

function normalizeBaseUrl(baseUrl: string | undefined) {
  const fallback = "https://api.lava.ru";
  return (baseUrl?.trim() || fallback).replace(/\/$/, "");
}

function normalizeAuthorizationSignature(value: string | null) {
  if (!value) {
    return "";
  }

  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  const parts = normalized.split(/\s+/);
  return parts.length === 1 ? parts[0] : parts[parts.length - 1];
}

export function createLavaSignature(rawJson: string, secret: string) {
  return createHmac("sha256", secret).update(rawJson).digest("hex");
}

function readResponseId(payload: LavaInvoiceCreateResponse | null) {
  const rawId = payload?.data?.id ?? payload?.id;

  if (typeof rawId === "number" && Number.isFinite(rawId)) {
    return String(rawId);
  }

  if (typeof rawId === "string" && rawId.trim()) {
    return rawId;
  }

  return null;
}

function readResponseUrl(payload: LavaInvoiceCreateResponse | null) {
  const url =
    payload?.data?.payment_url ??
    payload?.data?.url ??
    payload?.data?.invoice_url ??
    payload?.data?.pay_url ??
    payload?.payment_url ??
    payload?.url ??
    payload?.invoice_url ??
    null;

  return typeof url === "string" && url.trim() ? url : null;
}

export async function createLavaInvoice(input: {
  apiBaseUrl?: string;
  apiKey: string;
  payload: LavaInvoiceCreateRequest;
}) {
  const apiBaseUrl = normalizeBaseUrl(input.apiBaseUrl);
  const endpoint = `${apiBaseUrl}/business/invoice/create`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify(input.payload),
  });

  const payload = (await response.json().catch(() => null)) as LavaInvoiceCreateResponse | null;
  const externalId = readResponseId(payload);
  const paymentUrl = readResponseUrl(payload);

  if (!response.ok || !payload || !externalId || !paymentUrl) {
    return {
      ok: false as const,
      httpStatus: response.status,
      payload,
    };
  }

  return {
    ok: true as const,
    httpStatus: response.status,
    payload,
    externalId,
    paymentUrl,
  };
}

export function verifyLavaWebhookSignature(input: {
  rawBody: string;
  authorizationHeader: string | null;
  webhookSecret: string;
}) {
  const incoming = normalizeAuthorizationSignature(input.authorizationHeader);
  if (!incoming) {
    return false;
  }

  const expected = createLavaSignature(input.rawBody, input.webhookSecret);

  const incomingBuffer = Buffer.from(incoming);
  const expectedBuffer = Buffer.from(expected);

  if (incomingBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(incomingBuffer, expectedBuffer);
}

export function mapLavaWebhookToOrderStatus(payload: LavaWebhookPayload) {
  const event = typeof payload["event"] === "string" ? payload["event"] : "";
  const type = typeof payload["type"] === "string" ? payload["type"] : "";
  const source = (payload.status || event || type || "").toString().toLowerCase();

  if (source === "success" || source === "payment.success" || source === "paid") {
    return "paid" as const;
  }

  if (
    source === "fail" ||
    source === "failed" ||
    source === "error" ||
    source === "cancel" ||
    source === "canceled" ||
    source === "cancelled" ||
    source === "payment.failed"
  ) {
    return "failed" as const;
  }

  return null;
}
