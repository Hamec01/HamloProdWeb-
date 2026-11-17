import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/client";
import { licenseSellerSchema, type LicenseSellerInput } from "@/lib/validations/license-seller";

export type SellerIdentity = Pick<LicenseSellerInput,
  "seller_name" | "seller_country" | "seller_city" | "seller_email" |
  "seller_telegram" | "seller_passport" | "seller_signature_image"
> & Partial<LicenseSellerInput>;

type SellerIdentityOptions = { strict?: boolean; includeSignature?: boolean };

export async function getSellerIdentity(options: SellerIdentityOptions = {}): Promise<LicenseSellerInput> {
  const { strict = true, includeSignature = true } = options;
  const saved = await prisma.licenseSellerSetting.findUnique({ where: { id: "default" } });
  const parsed = saved ? licenseSellerSchema.safeParse(saved.identity) : null;
  if (saved && !parsed?.success) throw new Error("SELLER_CONFIG_MISSING");

  // Initial values match LICENSEMAKER/src/models/seller.py. Admin settings take
  // precedence; existing installations can continue using their SELLER_* env.
  const identity: LicenseSellerInput = parsed?.success ? parsed.data : {
    seller_name: process.env.SELLER_NAME?.trim() || "Андрей Сякки",
    seller_alias: process.env.SELLER_ALIAS?.trim() || "HamloProd",
    seller_country: process.env.SELLER_COUNTRY?.trim() || "Финляндия",
    seller_city: process.env.SELLER_CITY?.trim() || "Турку",
    seller_email: process.env.SELLER_EMAIL?.trim() || "ham_hamilio@yahoo.com",
    seller_phone: process.env.SELLER_PHONE?.trim() || "+358 44 331 6763",
    seller_telegram: process.env.SELLER_TELEGRAM?.trim() || "",
    seller_passport: process.env.SELLER_PASSPORT?.trim() || "",
    seller_address: process.env.SELLER_ADDRESS?.trim() || "",
    seller_payment_requisites: process.env.SELLER_PAYMENT_REQUISITES?.trim() || "PayPal / IBAN / Card",
    seller_signature_image: "",
  };
  if (!includeSignature) return { ...identity, seller_signature_image: "" };
  if (identity.seller_signature_image) return identity;

  const configured = process.env.SELLER_SIGNATURE_PATH?.trim();
  const signaturePath = configured
    ? (path.isAbsolute(configured) ? configured : path.join(process.cwd(), "public", "signatures", path.basename(configured)))
    : path.join(process.cwd(), "LICENSEMAKER", "assets", "default_signature.png");
  const buffer = await readFile(signaturePath).catch(() => null);
  if (!buffer && strict) throw new Error("SELLER_SIGNATURE_MISSING");
  if (buffer) {
    const mime = /\.jpe?g$/i.test(signaturePath) ? "jpeg" : "png";
    identity.seller_signature_image = `data:image/${mime};base64,${buffer.toString("base64")}`;
  }
  return identity;
}
