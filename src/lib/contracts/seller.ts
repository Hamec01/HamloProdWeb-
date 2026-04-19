import { readFile } from "node:fs/promises";
import path from "node:path";

export type SellerIdentity = {
  seller_name: string;
  seller_country: string;
  seller_city: string;
  seller_email: string;
  seller_telegram: string;
  seller_passport: string;
  seller_signature_image: string;
};

function getRequiredValue(envName: string) {
  return process.env[envName]?.trim() || "";
}

function buildConfigError(missing: string[]) {
  const details = missing.join(", ");
  return new Error(process.env.NODE_ENV === "production" ? "SELLER_CONFIG_MISSING" : `SELLER_CONFIG_MISSING:${details}`);
}

async function readSignatureDataUri(signaturePath: string) {
  const absolutePath = path.isAbsolute(signaturePath)
    ? signaturePath
    : path.join(process.cwd(), "public", "signatures", path.basename(signaturePath));
  const buffer = await readFile(absolutePath).catch(() => null);

  if (!buffer) {
    throw new Error(process.env.NODE_ENV === "production" ? "SELLER_SIGNATURE_MISSING" : `SELLER_SIGNATURE_MISSING:${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function getSellerIdentity(): Promise<SellerIdentity> {
  const seller_name = getRequiredValue("SELLER_NAME");
  const seller_country = getRequiredValue("SELLER_COUNTRY");
  const seller_city = getRequiredValue("SELLER_CITY");
  const seller_email = getRequiredValue("SELLER_EMAIL");
  const seller_telegram = getRequiredValue("SELLER_TELEGRAM");
  const seller_passport = getRequiredValue("SELLER_PASSPORT");

  const missing = [
    ["SELLER_NAME", seller_name],
    ["SELLER_COUNTRY", seller_country],
    ["SELLER_CITY", seller_city],
    ["SELLER_EMAIL", seller_email],
    ["SELLER_TELEGRAM", seller_telegram],
    ["SELLER_PASSPORT", seller_passport],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw buildConfigError(missing);
  }

  const signaturePath = process.env.SELLER_SIGNATURE_PATH?.trim() || "seller-signature.png";
  const seller_signature_image = await readSignatureDataUri(signaturePath);

  return {
    seller_name,
    seller_country,
    seller_city,
    seller_email,
    seller_telegram,
    seller_passport,
    seller_signature_image,
  };
}
