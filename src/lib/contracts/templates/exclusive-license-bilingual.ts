import nunjucks from "nunjucks";
import template from "../../../../LICENSEMAKER/templates/default_template.json";
import type { SellerIdentity } from "@/lib/contracts/seller";
import type { ExclusiveRightsRenderMode } from "@/lib/contracts/templates/exclusive-rights-ru";

type ExclusiveLicenseData = SellerIdentity & {
  contract_number: string;
  date_ru: string;
  date_en: string;
  beat_title: string;
  beat_catalog_number: string;
  price: string;
  currency: string;
  buyer_full_name?: string | null;
  buyer_city?: string | null;
  buyer_country?: string | null;
  buyer_email?: string | null;
  buyer_phone?: string | null;
  buyer_stage_name?: string | null;
  buyer_acceptance_at?: string | null;
  payment_reference?: string | null;
  payment_method?: string;
  canonical_beat_id?: string;
  mode: ExclusiveRightsRenderMode;
};

// Only the trusted, checked-in LICENSEMAKER template is compiled. Party data is
// passed as context with HTML escaping, never interpreted as template source.
const env = new nunjucks.Environment([], { autoescape: true, throwOnUndefined: true });
const sections = (source: typeof template.sections_en) => source.map((section) => ({
  title: nunjucks.compile(section.title, env),
  paragraphs: section.paragraphs.map((paragraph) => nunjucks.compile(paragraph, env)),
}));
const english = sections(template.sections_en);
const russian = sections(template.sections_ru);
const escape = (value: string) => env.renderString("{{ value }}", { value });

export function renderExclusiveLicenseBilingual(data: ExclusiveLicenseData) {
  const buyer = (value?: string | null) => data.mode === "deferred" ? "________________" : value?.trim() || "________________";
  const context = {
    seller_full_name: data.seller_name, seller_alias: data.seller_alias || "HamloProd",
    seller_country: data.seller_country, seller_city: data.seller_city,
    seller_email: data.seller_email, seller_address: data.seller_address || "",
    seller_document_number: data.seller_passport, seller_phone: data.seller_phone || "",
    seller_city_signing: data.seller_city,
    buyer_full_name: buyer(data.buyer_full_name), buyer_alias: buyer(data.buyer_stage_name),
    buyer_country: buyer(data.buyer_country), buyer_city: buyer(data.buyer_city),
    buyer_email: buyer(data.buyer_email), buyer_phone: buyer(data.buyer_phone),
    buyer_city_signing: buyer(data.buyer_city), buyer_address: "", buyer_document_number: "",
    beat_title: data.beat_title, beat_title_en: data.beat_title,
    beat_catalog_number: data.beat_catalog_number, canonical_beat_id: data.canonical_beat_id || data.beat_catalog_number,
    contract_number: data.contract_number, contract_date: data.date_ru, contract_date_en: data.date_en,
    price_display_en: data.price, price_display_ru: data.price,
    territory: "Весь мир (All Worldwide)", term_years: "На весь срок действия авторских прав (Full Term)",
    retain_original_instrumental: true, attribution_text: "Prod. by HamloProd",
    governing_law: "Законодательство Финляндии (Laws of Finland)",
    dispute_jurisdiction: "Суд г. Турку, Финляндия (Courts of Turku, Finland)",
    original_youtube_url: "", original_iswc: "—", original_instrumental_isrc: "—",
    existing_releases_text_en: "To be specified by Producer", existing_releases_text_ru: "Уточняется правообладателем",
    samples_status_en: "Pending verification (UNKNOWN)", samples_status_ru: "Требуется проверка (UNKNOWN)",
    prior_licences_status_en: "Unchecked (UNCHECKED)", prior_licences_status_ru: "Не проверено (UNCHECKED)",
    content_id_status_en: "Unknown", content_id_status_ru: "Неизвестно",
    delivery_formats: "WAV + MP3 + STEMS", delivery_period_days: 3,
    // The desktop defaults are proposals; a checkout must not invent agreed splits.
    composer_name: data.seller_name, composer_share: "________________",
    lyrics_writer_name: buyer(data.buyer_full_name), lyrics_writer_share: "________________",
    other_cowriters: "________________", total_writer_split: "________________", pro_society: "________________",
    publisher_info: "________________", new_song_title: "________________", new_master_isrc: "________________",
    payment_method: data.payment_method || "Online payment / Онлайн-оплата", receipt_reference: data.payment_reference || "—",
  };
  const renderSections = (source: typeof english) => source.map((section) =>
    `<section><h2>${section.title.render(context)}</h2>${section.paragraphs.map((p) => `<p>${p.render(context)}</p>`).join("")}</section>`,
  ).join("");
  const signature = data.seller_signature_image && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(data.seller_signature_image)
    ? `<img src="${data.seller_signature_image}" alt="Producer signature / Подпись правообладателя" />` : '<span class="fill-line">________________</span>';
  const acceptance = data.mode !== "deferred" && data.buyer_acceptance_at ? escape(data.buyer_acceptance_at) : "________________";
  const signatures = `<div class="signatures"><div><strong>Producer / Правообладатель</strong><p>${escape(data.seller_name)}</p>${signature}</div>
    <div><strong>Artist / Артист</strong><p>${escape(buyer(data.buyer_full_name))}</p><p>Online acceptance recorded / Онлайн-акцепт зафиксирован: ${acceptance}</p></div></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${escape(data.contract_number)} | HamloProd</title>
    <style>
    * { box-sizing: border-box; } body { color: #171512; font: 9.5pt/1.4 Arial, sans-serif; margin: 0; }
    main { max-width: 860px; margin: auto; padding: 24px; } h1 { text-align: center; font-size: 17pt; }
    h2 { font-size: 11pt; margin: 18px 0 7px; break-after: avoid; } p { margin: 0 0 8px; overflow-wrap: anywhere; }
    .meta { display: flex; justify-content: space-between; border-bottom: 1px solid #aaa; padding-bottom: 10px; }
    .language-note { font-style: italic; margin: 14px 0; } .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px; break-inside: avoid; }
    .signatures img { max-width: 170px; max-height: 60px; } .language-break { break-before: page; margin-top: 28px; }
    @media print { main { padding: 0; } .language-break { margin-top: 0; } }
    </style></head><body><main data-template="LICENSEMAKER-${template.version}">
    <h1>ONE-TIME EXCLUSIVE BEAT LICENSE</h1><div class="meta"><span>No. ${escape(data.contract_number)}</span><span>${escape(data.date_en)}</span></div>
    <p class="language-note">${escape(template.language_note_en)}</p>${renderSections(english)}${signatures}
    <article class="language-break" lang="ru"><h1>ЭКСКЛЮЗИВНАЯ ЛИЦЕНЗИЯ НА БИТ — ОДНА ПРОДАЖА</h1>
    <div class="meta"><span>№ ${escape(data.contract_number)}</span><span>${escape(data.date_ru)}</span></div>
    <p class="language-note">${escape(template.language_note_ru)}</p>${renderSections(russian)}${signatures}</article></main></body></html>`;
}
