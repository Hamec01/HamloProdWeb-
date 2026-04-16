import { createHmac, timingSafeEqual } from "node:crypto";

type LavaInvoiceCreateRequest = {
  amount: number;
  currency: "RUB" | "USD";
  external_id: string;
  description?: string;
  success_url?: string;
  fail_url?: string;
  hook_url?: string;
  expire?: number;
};

type LavaInvoiceCreateResponse = {
  id?: string;
  url?: string;
  amount?: number;
  currency?: string;
  status?: string | number;
  error?: unknown;
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
  const fallback = "https://gate.lava.top";
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

export async function createLavaInvoice(input: {
  apiBaseUrl?: string;
  apiKey: string;
  payload: LavaInvoiceCreateRequest;
}) {
  const apiBaseUrl = normalizeBaseUrl(input.apiBaseUrl);
  const endpoint = `${apiBaseUrl}/invoice`;

  const body = JSON.stringify(input.payload);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body,
  });

  const payload = (await response.json().catch(() => null)) as LavaInvoiceCreateResponse | null;

  if (!response.ok || !payload || !payload.id || !payload.url) {
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
    externalId: payload.id,
    paymentUrl: payload.url,
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
