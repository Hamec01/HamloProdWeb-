import test from "node:test";
import assert from "node:assert/strict";
import { renderExclusiveLicenseBilingual } from "./exclusive-license-bilingual";

test("exclusive license renders both languages, retained instrumental terms and recorded acceptance", () => {
  const html = renderExclusiveLicenseBilingual({
    contract_number: "HP-12345678",
    date_ru: "29.10.2026",
    date_en: "October 29, 2026",
    beat_title: "Night <Drive>",
    beat_catalog_number: "CASE-12",
    price: "$100",
    currency: "USD",
    seller_name: "HamloProd",
    seller_country: "Finland",
    seller_city: "Turku",
    seller_email: "seller@example.com",
    seller_telegram: "https://t.me/Andrei91S",
    seller_passport: "",
    seller_signature_image: "",
    buyer_full_name: "Artist <One>",
    buyer_city: "Turku",
    buyer_country: "Finland",
    buyer_email: "artist@example.com",
    buyer_stage_name: "New Artist",
    buyer_acceptance_at: "2026-10-29T20:00:00.000Z",
    mode: "partial",
  });

  assert.match(html, /ONE-TIME EXCLUSIVE BEAT LICENSE/);
  assert.match(html, /ЭКСКЛЮЗИВНАЯ ЛИЦЕНЗИЯ НА БИТ/);
  assert.match(html, /may not demand takedown/);
  assert.match(html, /не вправе требовать снятия/);
  assert.match(html, /100%/);
  assert.match(html, /100%/);
  assert.match(html, /2026-10-29T20:00:00\.000Z/);
  assert.match(html, /Night &lt;Drive&gt;/);
  assert.match(html, /Artist &lt;One&gt;/);
  assert.doesNotMatch(html, /Night <Drive>/);
});

test("deferred license leaves buyer details blank without omitting contract terms", () => {
  const html = renderExclusiveLicenseBilingual({
    contract_number: "HP-12345678",
    date_ru: "29.10.2026",
    date_en: "October 29, 2026",
    beat_title: "Night Drive",
    beat_catalog_number: "",
    price: "100 $",
    currency: "USD",
    seller_name: "HamloProd",
    seller_country: "Finland",
    seller_city: "Turku",
    seller_email: "seller@example.com",
    seller_telegram: "",
    seller_passport: "",
    seller_signature_image: "",
    buyer_full_name: "Artist",
    mode: "deferred",
  });

  assert.match(html, /class="fill-line"/);
  assert.match(html, /one New Song/);
  assert.match(html, /одной Новой песни/);
});

test("LICENSEMAKER keeps all schedules and treats buyer template syntax as literal data", () => {
  const html = renderExclusiveLicenseBilingual({
    contract_number: "HP-TEST", date_ru: "17.11.2026", date_en: "November 17, 2026",
    beat_title: '<script>alert("beat")</script>', beat_catalog_number: "CASE-42", price: "$100", currency: "USD",
    seller_name: "Producer", seller_country: "Finland", seller_city: "Turku", seller_email: "seller@example.com",
    seller_telegram: "", seller_passport: "", seller_signature_image: "", buyer_full_name: "{{ 7 * 7 }} <img src=x>", mode: "partial",
  });
  for (const heading of ["SCHEDULE A", "SCHEDULE B", "SCHEDULE C", "ПРИЛОЖЕНИЕ A", "ПРИЛОЖЕНИЕ B", "ПРИЛОЖЕНИЕ C", "10. GENERAL PROVISIONS", "10. ПРОЧИЕ УСЛОВИЯ"]) assert.ok(html.includes(heading), heading);
  assert.ok(html.includes("{{ 7 * 7 }} &lt;img src=x&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("50.0%"), "must not invent agreed composition splits");
});
