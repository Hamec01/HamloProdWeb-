import type { Page, PageRequest } from "./common";

export type OrderStatus = "draft" | "pending_payment" | "pending_free_checkout" | "paid" | "cancelled" | "failed" | "refunded";
/** Currency units must be reconciled against existing price snapshots before M5. */
export type OrderRecord = {
  id: string;
  beatId: string;
  buyerUserId: string | null;
  buyerEmail: string;
  basePrice: number;
  finalPrice: number;
  currency: "USD" | "RUB";
  discountPercent: number;
  status: OrderStatus;
  provider: string | null;
  paymentExternalId: string | null;
  paymentUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
};
export type ReserveOrderInput = Pick<OrderRecord, "beatId" | "buyerEmail" | "basePrice" | "finalPrice" | "currency" | "discountPercent"> & {
  buyerUserId: string;
  expiresAt: string;
  idempotencyKey: string;
};

/** Trusted service boundary. No generic status update: sale invariants are atomic. */
export interface OrderRepository {
  findOwned(id: string, buyerUserId: string): Promise<OrderRecord | null>;
  listOwned(buyerUserId: string, page: PageRequest): Promise<Page<OrderRecord>>;
  /** Lock beat, require available, reserve and insert order in ONE transaction. */
  reserve(input: ReserveOrderInput): Promise<{ kind: "reserved"; order: OrderRecord } | { kind: "unavailable" }>;
  attachPayment(orderId: string, payment: { provider: string; externalId: string; url: string }): Promise<void>;
  /** After signature + amount/currency verification; event deduplication, order and
   * beat updates plus purchase/loyalty writes commit together. A late payment for
   * a released reservation returns conflict and requires refund reconciliation.
   */
  applyPaymentEvent(event: { provider: string; eventId: string; externalId: string; status: "paid" | "failed" | "refunded"; receivedAt: string }): Promise<"applied" | "duplicate" | "conflict" | "not_found">;
  /** Lock/recheck reservation ownership and expiry; never release a sold beat. */
  expireReservations(now: string, limit: number): Promise<number>;
}
