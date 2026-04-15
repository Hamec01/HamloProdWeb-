export type OrderStatus = "draft" | "pending_payment" | "paid" | "cancelled" | "failed" | "refunded";

export type Order = {
  id: string;
  beatId: string;
  buyerUserId: string | null;
  buyerEmail: string;
  buyerName: string | null;
  buyerCountry: string | null;
  buyerCity: string | null;
  buyerPhone: string | null;
  licenseType: "basic" | "exclusive";
  contractLanguage: "ru" | "en";
  basePriceUsd: number;
  discountPercent: number;
  finalPriceUsd: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};
