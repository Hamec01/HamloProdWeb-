export type ContractVars = {
  contract_number: string;
  current_date: string;
  beat_title: string;
  license_type: string;
  buyer_name: string;
  buyer_email: string;
  buyer_country: string;
  buyer_city: string;
  buyer_phone: string;
  amount: string;
  currency: string;
  seller_name: string;
  seller_country: string;
  seller_city: string;
};

const BASE_STYLE = `
  body{margin:0;padding:40px 32px;font-family:'IBM Plex Mono',monospace,'Courier New';
    background:#fff;color:#111;font-size:13px;line-height:1.8}
  h1{font-size:16px;text-transform:uppercase;letter-spacing:.18em;margin:0 0 6px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.14em;margin:28px 0 8px;
    border-bottom:1px solid #ccc;padding-bottom:4px}
  .meta{color:#555;font-size:11px;letter-spacing:.1em;margin-bottom:32px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  td{padding:6px 8px;border:1px solid #ccc;vertical-align:top;font-size:12px}
  td:first-child{white-space:nowrap;color:#555;width:42%}
  .clause{margin-bottom:14px}
  .clause strong{display:block;text-transform:uppercase;font-size:11px;
    letter-spacing:.14em;margin-bottom:4px}
  .signatures{margin-top:48px;display:flex;gap:60px}
  .sig-block{flex:1}
  .sig-line{border-bottom:1px solid #111;margin-top:32px;margin-bottom:4px}
  .sig-label{font-size:11px;color:#555;letter-spacing:.1em}
  @media print{body{padding:20px}}
`;

function injectVars(template: string, vars: ContractVars): string {
  return Object.entries(vars).reduce(
    (html, [key, val]) => html.replaceAll(`{{${key}}}`, val),
    template,
  );
}

// ─── RU ──────────────────────────────────────────────────────────────────────
const TEMPLATE_RU = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<title>Лицензионный договор №{{contract_number}}</title>
<style>${BASE_STYLE}</style></head><body>
<h1>Лицензионный договор №{{contract_number}}</h1>
<p class="meta">от {{current_date}}</p>

<p>Настоящий договор заключён между:</p>

<h2>Стороны договора</h2>
<table>
  <tr><td>Лицензиар (Продавец)</td><td><strong>{{seller_name}}</strong><br>{{seller_country}}, {{seller_city}}</td></tr>
  <tr><td>Лицензиат (Покупатель)</td><td><strong>{{buyer_name}}</strong><br>{{buyer_country}}, {{buyer_city}}<br>{{buyer_email}}<br>{{buyer_phone}}</td></tr>
</table>

<h2>Предмет договора</h2>
<div class="clause">
  <strong>Объект лицензии</strong>
  Музыкальное произведение (бит): <strong>{{beat_title}}</strong>
</div>
<div class="clause">
  <strong>Тип лицензии</strong>
  {{license_type}}
</div>

<h2>Стоимость и порядок расчётов</h2>
<table>
  <tr><td>Сумма</td><td>{{amount}} {{currency}}</td></tr>
  <tr><td>Договор №</td><td>{{contract_number}}</td></tr>
  <tr><td>Дата</td><td>{{current_date}}</td></tr>
</table>

<h2>Права и обязательства</h2>
<div class="clause">
  <strong>1. Лицензиар предоставляет</strong>
  Неисключительное (базовая лицензия) или исключительное (эксклюзивная лицензия) право использовать музыкальное произведение в коммерческих и некоммерческих целях, включая запись, дистрибуцию и публичное исполнение.
</div>
<div class="clause">
  <strong>2. Лицензиат обязуется</strong>
  Указывать авторство Лицензиара при публичном использовании произведения. Не передавать лицензию третьим лицам без письменного согласия Лицензиара.
</div>
<div class="clause">
  <strong>3. Исключительная лицензия</strong>
  При выборе эксклюзивной лицензии Лицензиар прекращает продажу данного бита прочим лицам с момента полной оплаты.
</div>
<div class="clause">
  <strong>4. Действие договора</strong>
  Договор вступает в силу с момента поступления полной оплаты и действует бессрочно.
</div>

<h2>Подписи сторон</h2>
<div class="signatures">
  <div class="sig-block">
    <div><strong>Лицензиар:</strong> {{seller_name}}</div>
    <div class="sig-line"></div>
    <div class="sig-label">Подпись / Дата</div>
  </div>
  <div class="sig-block">
    <div><strong>Лицензиат:</strong> {{buyer_name}}</div>
    <div class="sig-line"></div>
    <div class="sig-label">Подпись / Дата</div>
  </div>
</div>
</body></html>`;

// ─── EN ──────────────────────────────────────────────────────────────────────
const TEMPLATE_EN = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>License Agreement #{{contract_number}}</title>
<style>${BASE_STYLE}</style></head><body>
<h1>License Agreement #{{contract_number}}</h1>
<p class="meta">Dated {{current_date}}</p>

<p>This agreement is entered into between:</p>

<h2>Parties</h2>
<table>
  <tr><td>Licensor (Seller)</td><td><strong>{{seller_name}}</strong><br>{{seller_country}}, {{seller_city}}</td></tr>
  <tr><td>Licensee (Buyer)</td><td><strong>{{buyer_name}}</strong><br>{{buyer_country}}, {{buyer_city}}<br>{{buyer_email}}<br>{{buyer_phone}}</td></tr>
</table>

<h2>Subject Matter</h2>
<div class="clause">
  <strong>Licensed Work</strong>
  Musical composition (beat): <strong>{{beat_title}}</strong>
</div>
<div class="clause">
  <strong>License Type</strong>
  {{license_type}}
</div>

<h2>Payment</h2>
<table>
  <tr><td>Amount</td><td>{{amount}} {{currency}}</td></tr>
  <tr><td>Agreement #</td><td>{{contract_number}}</td></tr>
  <tr><td>Date</td><td>{{current_date}}</td></tr>
</table>

<h2>Rights and Obligations</h2>
<div class="clause">
  <strong>1. Licensor grants</strong>
  A non-exclusive (Basic license) or exclusive (Exclusive license) right to use the musical composition for commercial and non-commercial purposes, including recording, distribution, and public performance.
</div>
<div class="clause">
  <strong>2. Licensee agrees</strong>
  To credit the Licensor when using the work publicly. Not to sublicense or transfer the rights without prior written consent of the Licensor.
</div>
<div class="clause">
  <strong>3. Exclusive license</strong>
  Upon selection of the Exclusive license, the Licensor ceases selling the beat to other parties upon receipt of full payment.
</div>
<div class="clause">
  <strong>4. Term</strong>
  This agreement becomes effective upon receipt of full payment and remains in force indefinitely.
</div>

<h2>Signatures</h2>
<div class="signatures">
  <div class="sig-block">
    <div><strong>Licensor:</strong> {{seller_name}}</div>
    <div class="sig-line"></div>
    <div class="sig-label">Signature / Date</div>
  </div>
  <div class="sig-block">
    <div><strong>Licensee:</strong> {{buyer_name}}</div>
    <div class="sig-line"></div>
    <div class="sig-label">Signature / Date</div>
  </div>
</div>
</body></html>`;

// ─── BILINGUAL ────────────────────────────────────────────────────────────────
const TEMPLATE_BILINGUAL = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<title>Лицензионный договор / License Agreement №{{contract_number}}</title>
<style>${BASE_STYLE}
  .bilingual td:first-child{width:28%}
  .col-ru{width:36%} .col-en{width:36%}
  .lang-header{font-size:10px;text-transform:uppercase;letter-spacing:.14em;
    color:#888;padding:4px 8px;background:#f4f4f4;border-bottom:1px solid #ccc}
</style></head><body>
<h1>Лицензионный договор / License Agreement №{{contract_number}}</h1>
<p class="meta">от {{current_date}} / Dated {{current_date}}</p>

<h2>Стороны / Parties</h2>
<table class="bilingual">
  <tr>
    <td>Лицензиар / Licensor</td>
    <td>{{seller_name}}, {{seller_country}}, {{seller_city}}</td>
  </tr>
  <tr>
    <td>Лицензиат / Licensee</td>
    <td>{{buyer_name}}, {{buyer_country}}, {{buyer_city}}<br>{{buyer_email}} / {{buyer_phone}}</td>
  </tr>
</table>

<h2>Предмет / Subject</h2>
<table class="bilingual">
  <tr><td>Бит / Beat</td><td><strong>{{beat_title}}</strong></td></tr>
  <tr><td>Лицензия / License</td><td>{{license_type}}</td></tr>
  <tr><td>Сумма / Amount</td><td>{{amount}} {{currency}}</td></tr>
  <tr><td>Дата / Date</td><td>{{current_date}}</td></tr>
  <tr><td>Договор № / Agreement #</td><td>{{contract_number}}</td></tr>
</table>

<h2>Условия / Terms</h2>
<div class="clause">
  <strong>1. Предоставление прав / Grant of rights</strong>
  RU: Лицензиар предоставляет право использовать произведение в коммерческих и некоммерческих целях.<br>
  EN: Licensor grants the right to use the composition for commercial and non-commercial purposes.
</div>
<div class="clause">
  <strong>2. Обязательства / Obligations</strong>
  RU: Лицензиат обязуется указывать авторство и не передавать права без письменного согласия Лицензиара.<br>
  EN: Licensee agrees to credit the Licensor and not to sublicense without prior written consent.
</div>
<div class="clause">
  <strong>3. Действие / Term</strong>
  RU: Договор вступает в силу с момента оплаты и действует бессрочно.<br>
  EN: This agreement is effective upon payment and remains in force indefinitely.
</div>

<h2>Подписи / Signatures</h2>
<div class="signatures">
  <div class="sig-block">
    <div><strong>Лицензиар / Licensor:</strong> {{seller_name}}</div>
    <div class="sig-line"></div>
    <div class="sig-label">Подпись / Signature &amp; Date</div>
  </div>
  <div class="sig-block">
    <div><strong>Лицензиат / Licensee:</strong> {{buyer_name}}</div>
    <div class="sig-line"></div>
    <div class="sig-label">Подпись / Signature &amp; Date</div>
  </div>
</div>
</body></html>`;

// ─── Public renderer ──────────────────────────────────────────────────────────
export type ContractLanguage = "ru" | "en" | "bilingual";

export function renderContractHtml(
  language: ContractLanguage,
  vars: ContractVars,
): string {
  const template =
    language === "en"
      ? TEMPLATE_EN
      : language === "bilingual"
        ? TEMPLATE_BILINGUAL
        : TEMPLATE_RU;
  return injectVars(template, vars);
}

export function buildContractNumber(orderId: string, date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const suffix = orderId.slice(0, 6).toUpperCase();
  return `HP-${y}${m}${d}-${suffix}`;
}

export function formatContractDate(date: Date, language: ContractLanguage): string {
  const locale = language === "en" ? "en-US" : "ru-RU";
  return date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}
