import { createHmac, timingSafeEqual } from "node:crypto";

type LavaInvoiceCreateRequest = {
  shopId: string;
  sum: number;
  orderId: string;
  hookUrl?: string;
  successUrl?: string;
  failUrl?: string;
  expire?: number;
  customFields?: string;
  comment?: string;
  includeService?: string[];
  excludeService?: string[];
};

type LavaInvoiceCreateResponse = {
  data?: {
    id?: string;
    url?: string;
    amount?: number;
    status?: string | number;
  };
  status?: number;
  status_check?: boolean;
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

export async function createLavaInvoice(input: {
  apiBaseUrl?: string;
  signatureSecret: string;
  payload: LavaInvoiceCreateRequest;
}) {
  const apiBaseUrl = normalizeBaseUrl(input.apiBaseUrl);
  const endpoint = `${apiBaseUrl}/business/invoice/create`;

  const body = JSON.stringify(input.payload);
  const signature = createLavaSignature(body, input.signatureSecret);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Signature: signature,
    },
    body,
  });

  const payload = (await response.json().catch(() => null)) as LavaInvoiceCreateResponse | null;

  if (!response.ok || !payload || !payload.status_check || !payload.data?.id || !payload.data?.url) {
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
    externalId: payload.data.id,
    paymentUrl: payload.data.url,
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
