export type ContractData = {
  orderId: string;
  beatCaseNumber: string;
  beatTitle: string;
  buyerName: string;
  buyerEmail: string;
  buyerCountry: string;
  buyerCity: string;
  buyerPhone: string;
  licenseType: "basic" | "exclusive";
  basePriceUsd: number;
  discountPercent: number;
  finalPriceUsd: number;
  contractLanguage: "ru" | "en";
  issuedAt: string; // ISO date string
};

function formatUsd(value: number, lang: "ru" | "en") {
  return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string, lang: "ru" | "en") {
  return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "long",
  }).format(new Date(iso));
}

export function generateContractHtml(data: ContractData): string {
  const lang = data.contractLanguage;
  const isRu = lang === "ru";

  const t = {
    title: isRu ? "ЛИЦЕНЗИОННЫЙ ДОГОВОР" : "LICENSE AGREEMENT",
    subtitle: isRu
      ? "на использование музыкального произведения"
      : "for use of a musical work",
    orderId: isRu ? "Номер заказа" : "Order ID",
    issuedAt: isRu ? "Дата договора" : "Agreement Date",
    sellerTitle: isRu ? "ЛИЦЕНЗИАР (Продавец)" : "LICENSOR (Seller)",
    buyerTitle: isRu ? "ЛИЦЕНЗИАТ (Покупатель)" : "LICENSEE (Buyer)",
    name: isRu ? "Имя / ФИО" : "Full Name",
    email: isRu ? "Email" : "Email",
    country: isRu ? "Страна" : "Country",
    city: isRu ? "Город" : "City",
    phone: isRu ? "Телефон" : "Phone",
    subjectTitle: isRu ? "ПРЕДМЕТ ДОГОВОРА" : "SUBJECT OF AGREEMENT",
    beat: isRu ? "Музыкальное произведение" : "Musical Work",
    licenseType: isRu ? "Тип лицензии" : "License Type",
    licenseBasic: isRu ? "Базовая (неэксклюзивная)" : "Basic (Non-exclusive)",
    licenseExclusive: isRu ? "Эксклюзивная" : "Exclusive",
    priceTitle: isRu ? "СТОИМОСТЬ ЛИЦЕНЗИИ" : "LICENSE PRICE",
    basePrice: isRu ? "Базовая цена" : "Base Price",
    discount: isRu ? "Скидка (программа лояльности)" : "Discount (loyalty program)",
    finalPrice: isRu ? "Итого к оплате" : "Total Due",
    free: isRu ? "Бесплатно (скидка 100%)" : "Free (100% discount)",
    termsTitle: isRu ? "УСЛОВИЯ ЛИЦЕНЗИИ" : "LICENSE TERMS",
    termsBasicRu: `
      <li>Лицензиат имеет право использовать произведение в некоммерческих и ограниченно коммерческих целях.</li>
      <li>Разрешается использование в аудио- и видеозаписях, публикациях в интернете и на стриминговых платформах.</li>
      <li>Лицензиат не имеет права передавать лицензию третьим лицам и перепродавать произведение в исходном виде.</li>
      <li>Авторство произведения (HamloProd) должно быть указано при публикации.</li>
      <li>Лицензиар сохраняет за собой право выдавать иные неэксклюзивные лицензии на данное произведение.</li>
    `,
    termsBasicEn: `
      <li>The Licensee may use the work for non-commercial and limited commercial purposes.</li>
      <li>Permitted uses include audio/video recordings and publications on streaming platforms.</li>
      <li>The Licensee may not sublicense or resell the work in its original form.</li>
      <li>Credit to the author (HamloProd) must be given upon publication.</li>
      <li>The Licensor retains the right to issue other non-exclusive licenses for this work.</li>
    `,
    termsExclusiveRu: `
      <li>Лицензиат получает исключительное право на коммерческое использование произведения.</li>
      <li>Лицензиар обязуется не выдавать иных лицензий на данное произведение после вступления настоящего договора в силу.</li>
      <li>Лицензиат вправе использовать произведение без ограничений по тиражу и площадкам.</li>
      <li>Перепродажа произведения в исходном виде запрещена.</li>
      <li>Авторские права на мелодию сохраняются за HamloProd.</li>
    `,
    termsExclusiveEn: `
      <li>The Licensee obtains exclusive rights to use the work commercially.</li>
      <li>The Licensor agrees not to issue any further licenses for this work after this agreement takes effect.</li>
      <li>The Licensee may use the work without restrictions on distribution volume or platform.</li>
      <li>Reselling the work in its original form is prohibited.</li>
      <li>The melodic copyright remains with HamloProd.</li>
    `,
    signaturesTitle: isRu ? "ПОДПИСИ СТОРОН" : "SIGNATURES",
    licensorSig: isRu ? "Лицензиар: HamloProd" : "Licensor: HamloProd",
    licenseeSig: isRu ? "Лицензиат" : "Licensee",
    signField: isRu ? "Подпись / Ф.И.О." : "Signature / Full Name",
    footerNote: isRu
      ? "Настоящий договор сформирован автоматически на основании данных заказа."
      : "This agreement was generated automatically based on the order data.",
  };

  const licenseLabel =
    data.licenseType === "exclusive" ? t.licenseExclusive : t.licenseBasic;

  const termsItems =
    data.licenseType === "exclusive"
      ? isRu
        ? t.termsExclusiveRu
        : t.termsExclusiveEn
      : isRu
        ? t.termsBasicRu
        : t.termsBasicEn;

  const priceBlock =
    data.finalPriceUsd === 0
      ? `<tr><td>${t.finalPrice}</td><td><strong>${t.free}</strong></td></tr>`
      : `
      <tr><td>${t.basePrice}</td><td>${formatUsd(data.basePriceUsd, lang)}</td></tr>
      ${data.discountPercent > 0 ? `<tr><td>${t.discount}</td><td>−${data.discountPercent}%</td></tr>` : ""}
      <tr><td><strong>${t.finalPrice}</strong></td><td><strong>${formatUsd(data.finalPriceUsd, lang)}</strong></td></tr>
    `;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "IBM Plex Mono", "Courier New", monospace;
    font-size: 13px;
    line-height: 1.7;
    color: #e8e4dc;
    background: #0f0d0a;
    padding: 40px 24px;
    max-width: 800px;
    margin: 0 auto;
  }
  h1 {
    font-size: 22px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #f5f2ea;
    margin-bottom: 4px;
  }
  .subtitle {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.28em;
    color: #8a857a;
    margin-bottom: 32px;
  }
  section { margin-bottom: 28px; }
  h2 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3em;
    color: #8a857a;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #2a2620;
  }
  table { width: 100%; border-collapse: collapse; }
  td {
    padding: 5px 8px;
    border-bottom: 1px solid #1e1c18;
    vertical-align: top;
  }
  td:first-child { color: #8a857a; width: 40%; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; }
  .sig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 16px;
  }
  .sig-box {
    border-top: 1px solid #3a3630;
    padding-top: 10px;
    font-size: 11px;
    color: #8a857a;
  }
  .sig-name { color: #e8e4dc; font-size: 13px; margin-bottom: 4px; }
  .footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #2a2620;
    font-size: 10px;
    color: #5a564f;
    text-align: center;
  }
</style>
</head>
<body>
  <h1>${t.title}</h1>
  <p class="subtitle">${t.subtitle}</p>

  <section>
    <table>
      <tr><td>${t.orderId}</td><td>${data.orderId}</td></tr>
      <tr><td>${t.issuedAt}</td><td>${formatDate(data.issuedAt, lang)}</td></tr>
    </table>
  </section>

  <section>
    <h2>${t.sellerTitle}</h2>
    <table>
      <tr><td>${t.name}</td><td>HamloProd</td></tr>
      <tr><td>${t.email}</td><td>hamloprod@gmail.com</td></tr>
    </table>
  </section>

  <section>
    <h2>${t.buyerTitle}</h2>
    <table>
      <tr><td>${t.name}</td><td>${escHtml(data.buyerName)}</td></tr>
      <tr><td>${t.email}</td><td>${escHtml(data.buyerEmail)}</td></tr>
      <tr><td>${t.country}</td><td>${escHtml(data.buyerCountry)}</td></tr>
      <tr><td>${t.city}</td><td>${escHtml(data.buyerCity)}</td></tr>
      <tr><td>${t.phone}</td><td>${escHtml(data.buyerPhone)}</td></tr>
    </table>
  </section>

  <section>
    <h2>${t.subjectTitle}</h2>
    <table>
      <tr><td>${t.beat}</td><td>CASE #${escHtml(data.beatCaseNumber)} — ${escHtml(data.beatTitle)}</td></tr>
      <tr><td>${t.licenseType}</td><td>${licenseLabel}</td></tr>
    </table>
  </section>

  <section>
    <h2>${t.priceTitle}</h2>
    <table>${priceBlock}</table>
  </section>

  <section>
    <h2>${t.termsTitle}</h2>
    <ul>${termsItems}</ul>
  </section>

  <section>
    <h2>${t.signaturesTitle}</h2>
    <div class="sig-grid">
      <div class="sig-box">
        <p class="sig-name">${t.licensorSig}</p>
        <p>${t.signField}: _______________</p>
      </div>
      <div class="sig-box">
        <p class="sig-name">${t.licenseeSig}: ${escHtml(data.buyerName)}</p>
        <p>${t.signField}: _______________</p>
      </div>
    </div>
  </section>

  <div class="footer">${t.footerNote}</div>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
