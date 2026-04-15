/**
 * Contract HTML templates for HamloProd license agreements.
 *
 * Three variants:
 *   "ru"         – Russian only
 *   "en"         – English only
 *   "bilingual"  – Russian + English stacked
 *
 * All variables are injected via {{variable_name}} placeholders that are
 * HTML-escaped before insertion to prevent XSS in the snapshot.
 */

export type ContractLocale = "ru" | "en" | "bilingual";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inject(template: string, vars: ContractVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = vars[key as keyof ContractVars];
    return value !== undefined ? esc(value) : "";
  });
}

// ---------------------------------------------------------------------------
// Shared CSS
// ---------------------------------------------------------------------------

const SHARED_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Serif:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'IBM Plex Serif', Georgia, serif;
    font-size: 13px;
    line-height: 1.7;
    color: #1a1a1a;
    background: #fff;
  }

  .contract-wrap {
    max-width: 760px;
    margin: 0 auto;
    padding: 48px 56px;
  }

  .contract-header {
    text-align: center;
    margin-bottom: 40px;
    padding-bottom: 24px;
    border-bottom: 2px solid #1a1a1a;
  }

  .contract-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 18px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .contract-meta {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.14em;
    color: #555;
  }

  .contract-section {
    margin-bottom: 28px;
  }

  .contract-section-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #444;
    margin-bottom: 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid #ddd;
  }

  .parties-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 8px;
  }

  .party-block {
    padding: 14px 16px;
    border: 1px solid #ddd;
    background: #fafafa;
  }

  .party-role {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 6px;
  }

  .party-name {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .party-detail {
    font-size: 12px;
    color: #555;
    line-height: 1.5;
  }

  .clause {
    margin-bottom: 14px;
  }

  .clause-num {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    margin-right: 8px;
    color: #333;
  }

  .payment-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 6px 0;
    border-bottom: 1px dashed #e0e0e0;
  }

  .payment-row.total {
    border-bottom: 2px solid #1a1a1a;
    font-weight: 500;
    font-size: 14px;
  }

  .payment-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.1em;
    color: #555;
  }

  .payment-value {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
  }

  .sig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 48px;
  }

  .sig-block {
    padding-top: 16px;
    border-top: 1px solid #555;
  }

  .sig-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: #888;
  }

  .sig-name {
    margin-top: 4px;
    font-size: 13px;
  }

  .divider {
    border: none;
    border-top: 1px solid #ddd;
    margin: 32px 0;
  }

  .lang-badge {
    display: inline-block;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    background: #1a1a1a;
    color: #fff;
    padding: 2px 8px;
    margin-bottom: 20px;
  }
`;

// ---------------------------------------------------------------------------
// Russian template body
// ---------------------------------------------------------------------------

function bodyRu(v: ContractVars): string {
  const isExclusive = v.license_type === "exclusive";
  const licenseLabel = isExclusive ? "Эксклюзивная лицензия" : "Базовая лицензия (неисключительная)";

  return `
    <div class="contract-header">
      <div class="contract-title">Лицензионный договор</div>
      <div class="contract-meta">
        № {{contract_number}} &nbsp;·&nbsp; {{current_date}}
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">Стороны договора</div>
      <div class="parties-grid">
        <div class="party-block">
          <div class="party-role">Лицензиар (Продавец)</div>
          <div class="party-name">{{seller_name}}</div>
          <div class="party-detail">{{seller_country}}, {{seller_city}}</div>
        </div>
        <div class="party-block">
          <div class="party-role">Лицензиат (Покупатель)</div>
          <div class="party-name">{{buyer_name}}</div>
          <div class="party-detail">
            {{buyer_country}}, {{buyer_city}}<br>
            {{buyer_email}}<br>
            {{buyer_phone}}
          </div>
        </div>
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">Предмет договора</div>
      <div class="clause">
        <span class="clause-num">1.1</span>
        Лицензиар предоставляет Лицензиату право использования музыкального произведения:
        <strong>«{{beat_title}}»</strong> на условиях <strong>{{licenseLabel}}</strong>.
      </div>
      <div class="clause">
        <span class="clause-num">1.2</span>
        ${isExclusive
          ? "Эксклюзивная лицензия предоставляет Лицензиату исключительное право на использование произведения. После передачи эксклюзивной лицензии произведение снимается с продажи."
          : "Базовая (неисключительная) лицензия предоставляет Лицензиату право использования произведения без исключительных прав. Лицензиар вправе выдавать аналогичные лицензии иным лицам."}
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">Права и ограничения</div>
      <div class="clause">
        <span class="clause-num">2.1</span>
        Лицензиат вправе использовать произведение в коммерческих и некоммерческих проектах (запись треков, выступления, видеопродукция, стриминг).
      </div>
      <div class="clause">
        <span class="clause-num">2.2</span>
        Лицензиат не вправе перепродавать, сублицензировать или передавать данное произведение третьим лицам как самостоятельный продукт.
      </div>
      <div class="clause">
        <span class="clause-num">2.3</span>
        В публикациях необходимо указывать авторство: <strong>prod. {{seller_name}}</strong>.
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">Стоимость лицензии</div>
      <div class="payment-row total">
        <span class="payment-label">Итого к оплате</span>
        <span class="payment-value">{{amount}} {{currency}}</span>
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">Срок действия</div>
      <div class="clause">
        <span class="clause-num">3.1</span>
        ${isExclusive
          ? "Настоящий договор действует бессрочно с момента получения полной оплаты."
          : "Лицензия предоставляется бессрочно с момента получения полной оплаты."}
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">Прочие условия</div>
      <div class="clause">
        <span class="clause-num">4.1</span>
        Настоящий договор составлен в соответствии с действующим законодательством.
      </div>
      <div class="clause">
        <span class="clause-num">4.2</span>
        Лицензиар гарантирует наличие прав на данное произведение.
      </div>
      <div class="clause">
        <span class="clause-num">4.3</span>
        Договор вступает в силу после полной оплаты лицензионного вознаграждения.
      </div>
    </div>

    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-label">Лицензиар</div>
        <div class="sig-name">{{seller_name}}</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Лицензиат</div>
        <div class="sig-name">{{buyer_name}}</div>
      </div>
    </div>
  `
    .replace(/\{\{licenseLabel\}\}/g, esc(licenseLabel));
}

// ---------------------------------------------------------------------------
// English template body
// ---------------------------------------------------------------------------

function bodyEn(v: ContractVars): string {
  const isExclusive = v.license_type === "exclusive";
  const licenseLabel = isExclusive ? "Exclusive License" : "Basic License (Non-Exclusive)";

  return `
    <div class="contract-header">
      <div class="contract-title">License Agreement</div>
      <div class="contract-meta">
        No. {{contract_number}} &nbsp;·&nbsp; {{current_date}}
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">Parties</div>
      <div class="parties-grid">
        <div class="party-block">
          <div class="party-role">Licensor (Seller)</div>
          <div class="party-name">{{seller_name}}</div>
          <div class="party-detail">{{seller_country}}, {{seller_city}}</div>
        </div>
        <div class="party-block">
          <div class="party-role">Licensee (Buyer)</div>
          <div class="party-name">{{buyer_name}}</div>
          <div class="party-detail">
            {{buyer_country}}, {{buyer_city}}<br>
            {{buyer_email}}<br>
            {{buyer_phone}}
          </div>
        </div>
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">Subject of Agreement</div>
      <div class="clause">
        <span class="clause-num">1.1</span>
        The Licensor grants the Licensee the right to use the musical work:
        <strong>«{{beat_title}}»</strong> under the terms of a <strong>{{licenseLabel}}</strong>.
      </div>
      <div class="clause">
        <span class="clause-num">1.2</span>
        ${isExclusive
          ? "An Exclusive License grants the Licensee sole rights to use the work. Upon transfer of the exclusive license, the work will be removed from sale."
          : "A Basic (Non-Exclusive) License grants the Licensee the right to use the work without exclusive rights. The Licensor may issue similar licenses to other parties."}
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">Rights and Restrictions</div>
      <div class="clause">
        <span class="clause-num">2.1</span>
        The Licensee may use the work in commercial and non-commercial projects (recording tracks, performances, video production, streaming).
      </div>
      <div class="clause">
        <span class="clause-num">2.2</span>
        The Licensee may not resell, sublicense, or transfer the work to third parties as a standalone product.
      </div>
      <div class="clause">
        <span class="clause-num">2.3</span>
        All publications must credit: <strong>prod. {{seller_name}}</strong>.
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">License Fee</div>
      <div class="payment-row total">
        <span class="payment-label">Total due</span>
        <span class="payment-value">{{amount}} {{currency}}</span>
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">Term</div>
      <div class="clause">
        <span class="clause-num">3.1</span>
        ${isExclusive
          ? "This Agreement is perpetual and takes effect upon receipt of full payment."
          : "The license is granted in perpetuity and takes effect upon receipt of full payment."}
      </div>
    </div>

    <div class="contract-section">
      <div class="contract-section-title">General Provisions</div>
      <div class="clause">
        <span class="clause-num">4.1</span>
        This Agreement is governed by applicable law.
      </div>
      <div class="clause">
        <span class="clause-num">4.2</span>
        The Licensor warrants that they hold all necessary rights to the work.
      </div>
      <div class="clause">
        <span class="clause-num">4.3</span>
        This Agreement becomes effective upon receipt of the full license fee.
      </div>
    </div>

    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-label">Licensor</div>
        <div class="sig-name">{{seller_name}}</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Licensee</div>
        <div class="sig-name">{{buyer_name}}</div>
      </div>
    </div>
  `
    .replace(/\{\{licenseLabel\}\}/g, esc(licenseLabel));
}

// ---------------------------------------------------------------------------
// Public render functions
// ---------------------------------------------------------------------------

function wrap(body: string, htmlLang: string): string {
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>License Agreement</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="contract-wrap">
    ${body}
  </div>
</body>
</html>`;
}

export function renderLicenseRu(vars: ContractVars): string {
  const body = inject(bodyRu(vars), vars);
  return wrap(body, "ru");
}

export function renderLicenseEn(vars: ContractVars): string {
  const body = inject(bodyEn(vars), vars);
  return wrap(body, "en");
}

export function renderLicenseBilingual(vars: ContractVars): string {
  const ruBody = inject(bodyRu(vars), vars);
  const enBody = inject(bodyEn(vars), vars);

  const bilingualBody = `
    <div class="lang-badge">RU</div>
    ${ruBody}
    <hr class="divider" />
    <div class="lang-badge">EN</div>
    ${enBody}
  `;
  // Bilingual: use "ru" as the primary document language since RU appears first
  return wrap(bilingualBody, "ru");
}

export function renderContractByLocale(locale: ContractLocale, vars: ContractVars): string {
  switch (locale) {
    case "en":
      return renderLicenseEn(vars);
    case "bilingual":
      return renderLicenseBilingual(vars);
    case "ru":
    default:
      return renderLicenseRu(vars);
  }
}
