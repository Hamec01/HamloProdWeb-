import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { licenseProfileSchema } from "./license-profile";
import { checkoutFormSchema } from "@/lib/validations/checkout";
import { MessageText } from "@/components/orders/message-text";

const profile = { fullName: "Иван Иванов", stageName: "MC Test", email: "buyer@example.invalid", country: "Россия", city: "Москва", phone: "" };
test("license contact details allow no phone and trim user input", () => {
  assert.deepEqual(licenseProfileSchema.parse({ ...profile, fullName: " Иван Иванов " }), profile);
  assert.equal(licenseProfileSchema.safeParse({ ...profile, phone: "123" }).success, false);
});
test("profile details cannot carry an account target, passport field or blanket acceptance", () => {
  for (const extra of [{ userId: "someone-else" }, { passport: "1234" }, { acceptance: true }]) assert.equal(licenseProfileSchema.safeParse({ ...profile, ...extra }).success, false);
});
test("manual checkout still requires explicit consent with optional phone and saved details", () => {
  const data = { beat_id: "00000000-0000-4000-8000-000000000001", buyer_name: profile.fullName, buyer_email: profile.email, buyer_stage_name: profile.stageName, buyer_country: profile.country, buyer_city: profile.city, buyer_phone: "", license_type: "exclusive", contract_language: "ru", payment_method: "contact", save_profile: true, acceptance: true, personal_data: true };
  assert.equal(checkoutFormSchema.safeParse(data).success, true);
  assert.equal(checkoutFormSchema.safeParse({ ...data, acceptance: false }).success, false);
  assert.equal(checkoutFormSchema.safeParse({ ...data, personal_data: false }).success, false);
});
test("payment links in chat are clickable while message HTML and script URLs stay inert", () => {
  const html = renderToStaticMarkup(createElement(MessageText, { text: '<script>alert(1)</script> javascript:alert(1) https://example.invalid/pay?order=1&currency=rub' }));
  assert.ok(html.includes('href="https://example.invalid/pay?order=1&amp;currency=rub"'));
  assert.ok(html.includes('rel="noopener noreferrer"')); assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes('href="javascript:')); assert.ok(!html.includes("<script>"));
});
