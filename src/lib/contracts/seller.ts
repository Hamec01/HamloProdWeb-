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

type SellerIdentityOptions = {
  strict?: boolean;
  includeSignature?: boolean;
};

function getValue(envName: string, fallback = "") {
  return process.env[envName]?.trim() || fallback;
}

function buildConfigError(missing: string[]) {
  const details = missing.join(", ");
  return new Error(process.env.NODE_ENV === "production" ? "SELLER_CONFIG_MISSING" : `SELLER_CONFIG_MISSING:${details}`);
}

async function readSignatureDataUri(signaturePath: string, strict: boolean) {
  const absolutePath = path.isAbsolute(signaturePath)
    ? signaturePath
    : path.join(process.cwd(), "public", "signatures", path.basename(signaturePath));
  const buffer = await readFile(absolutePath).catch(() => null);

  if (!buffer) {
    if (strict) {
      throw new Error(process.env.NODE_ENV === "production" ? "SELLER_SIGNATURE_MISSING" : `SELLER_SIGNATURE_MISSING:${absolutePath}`);
    }

    return "";
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function getSellerIdentity(options: SellerIdentityOptions = {}): Promise<SellerIdentity> {
  const { strict = true, includeSignature = true } = options;

  const seller_name = getValue("SELLER_NAME", "HamloProd");
  const seller_country = getValue("SELLER_COUNTRY", "Not specified");
  const seller_city = getValue("SELLER_CITY", "Not specified");
  const seller_email = getValue("SELLER_EMAIL", "Not specified");
  const seller_telegram = getValue("SELLER_TELEGRAM", "Not specified");
  const seller_passport = getValue("SELLER_PASSPORT", "Not specified");

  if (strict) {
    const missing = [
      ["SELLER_NAME", process.env.SELLER_NAME?.trim()],
      ["SELLER_COUNTRY", process.env.SELLER_COUNTRY?.trim()],
      ["SELLER_CITY", process.env.SELLER_CITY?.trim()],
      ["SELLER_EMAIL", process.env.SELLER_EMAIL?.trim()],
      ["SELLER_TELEGRAM", process.env.SELLER_TELEGRAM?.trim()],
      ["SELLER_PASSPORT", process.env.SELLER_PASSPORT?.trim()],
    ] as const;

    const missingKeys = missing
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingKeys.length > 0) {
      throw buildConfigError([...missingKeys]);
    }
  }

  const signaturePath = process.env.SELLER_SIGNATURE_PATH?.trim() || "seller-signature.png";
  const seller_signature_image = includeSignature ? await readSignatureDataUri(signaturePath, strict) : "";

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
