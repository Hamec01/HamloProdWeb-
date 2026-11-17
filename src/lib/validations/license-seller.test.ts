import test from "node:test";
import assert from "node:assert/strict";
import { licenseSellerSchema } from "./license-seller";

const seller = {
  seller_name: "  Андрей Сякки  ", seller_alias: "HamloProd", seller_country: "Finland", seller_city: "Turku",
  seller_email: "seller@example.com", seller_phone: "", seller_address: "", seller_passport: "", seller_telegram: "",
  seller_payment_requisites: "", seller_signature_image: "",
};

test("seller requires real party details but allows omitting passport and telegram", () => {
  assert.equal(licenseSellerSchema.parse(seller).seller_name, "Андрей Сякки");
  assert.equal(licenseSellerSchema.safeParse({ ...seller, seller_name: " " }).success, false);
  assert.equal(licenseSellerSchema.safeParse({ ...seller, seller_email: "bad" }).success, false);
});

test("seller signature accepts embedded PNG/JPEG only and limits size", () => {
  for (const value of ["https://example.com/sig.png", "file:///etc/passwd", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,\" onerror=alert(1)", "x".repeat(700_001)]) {
    assert.equal(licenseSellerSchema.safeParse({ ...seller, seller_signature_image: value }).success, false);
  }
  assert.equal(licenseSellerSchema.safeParse({ ...seller, seller_signature_image: "data:image/png;base64,aGVsbG8=" }).success, true);
});
