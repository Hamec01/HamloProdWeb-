import test from "node:test";
import assert from "node:assert/strict";
import { adminLicenseCreateSchema } from "./admin-license";

const validInput = {
  beatId: "2f9b9f4b-5ee7-4a0f-9f06-2efc9500f31c",
  buyerName: "Artist Name",
  buyerEmail: "artist@example.com",
  buyerCountry: "Finland",
  buyerCity: "Turku",
  buyerStageName: "Artist",
  amount: 25000,
  currency: "RUB",
  contractLanguage: "ru",
  buyerAcceptedTerms: true,
  buyerConsentedToData: true,
};

test("manual license requires a selected beat, confirmed payment and buyer consents", () => {
  assert.equal(adminLicenseCreateSchema.safeParse(validInput).success, true);
  assert.equal(adminLicenseCreateSchema.safeParse({ ...validInput, buyerAcceptedTerms: false }).success, false);
  assert.equal(adminLicenseCreateSchema.safeParse({ ...validInput, buyerConsentedToData: false }).success, false);
  assert.equal(adminLicenseCreateSchema.safeParse({ ...validInput, amount: 0 }).success, false);
  assert.equal(adminLicenseCreateSchema.safeParse({ ...validInput, additional: "unexpected" }).success, false);
});
