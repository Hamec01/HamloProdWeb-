export type ExclusiveRightsRenderMode = "deferred" | "partial";

type ExclusiveRightsRuTemplateData = {
  contract_number: string;
  current_date: string;
  beat_title: string;
  price: string;
  currency: string;
  seller_name: string;
  seller_city: string;
  seller_country: string;
  seller_email: string;
  seller_telegram: string;
  seller_passport: string;
  seller_signature_image: string;
  buyer_full_name?: string | null;
  buyer_city?: string | null;
  buyer_stage_name?: string | null;
  mode: ExclusiveRightsRenderMode;
  revealSellerPassport?: boolean;
};

function escapeHtml(input: string | null | undefined) {
  return (input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getFieldValue(value: string | null | undefined, mode: ExclusiveRightsRenderMode) {
  if (mode === "deferred") {
    return "<span class=\"fill-line\">&nbsp;</span>";
  }

  const normalized = value?.trim();
  return normalized ? escapeHtml(normalized) : "<span class=\"fill-line\">&nbsp;</span>";
}

export function renderExclusiveRightsRuTemplate(data: ExclusiveRightsRuTemplateData) {
  const buyerFullName = getFieldValue(data.buyer_full_name, data.mode);
  const buyerCity = getFieldValue(data.buyer_city, data.mode);
  const buyerStageName = getFieldValue(data.buyer_stage_name, data.mode);
  const sellerPassport = data.revealSellerPassport ? `, паспорт: ${escapeHtml(data.seller_passport)}` : "";
  const sellerSignature = `<img src="${data.seller_signature_image}" alt="Подпись правообладателя" class="seller-signature" />`;

  return `
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(data.contract_number)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ffffff;
        color: #111111;
        font-family: "Times New Roman", Georgia, serif;
        font-size: 12pt;
        line-height: 1.5;
      }
      .page {
        width: 100%;
        max-width: 840px;
        margin: 0 auto;
        padding: 32px 36px 40px;
      }
      h1 {
        margin: 0 0 20px;
        text-align: center;
        font-size: 18pt;
        font-weight: 700;
        text-transform: uppercase;
      }
      p { margin: 0 0 10px; }
      .meta {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .section-title {
        margin: 18px 0 8px;
        font-weight: 700;
      }
      .details-box,
      .signatures {
        border: 1px solid #1f1f1f;
        padding: 12px 14px;
        margin-top: 14px;
      }
      .fill-line {
        display: inline-block;
        min-width: 220px;
        border-bottom: 1px solid #1f1f1f;
        height: 1em;
        vertical-align: baseline;
      }
      .signature-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin-top: 18px;
      }
      .signature-label {
        margin-bottom: 34px;
      }
      .seller-signature {
        display: block;
        max-height: 58px;
        width: auto;
        margin: 10px 0 8px;
      }
      .small { font-size: 10.5pt; }
    </style>
  </head>
  <body>
    <main class="page">
      <h1>ДОГОВОР ОБ ОТЧУЖДЕНИИ ИСКЛЮЧИТЕЛЬНЫХ ПРАВ</h1>

      <div class="meta">
        <p>№ ${escapeHtml(data.contract_number)}</p>
        <p>${escapeHtml(data.current_date)}</p>
      </div>

      <p>
        Правообладатель ${escapeHtml(data.seller_name)}, ${escapeHtml(data.seller_city)},
        ${escapeHtml(data.seller_country)}, email: ${escapeHtml(data.seller_email)}, Telegram:
        ${escapeHtml(data.seller_telegram)}${sellerPassport}, именуемый далее «Правообладатель»,
        с одной стороны, и приобретатель ${buyerFullName}, именуемый далее «Приобретатель»,
        с другой стороны, заключили настоящий договор о нижеследующем.
      </p>

      <p class="section-title">1. Предмет договора</p>
      <p>
        Правообладатель отчуждает Приобретателю в полном объёме исключительное право на музыкальное
        произведение (бит) «${escapeHtml(data.beat_title)}», а Приобретатель принимает указанное
        исключительное право и выплачивает вознаграждение в размере ${escapeHtml(data.price)}.
      </p>

      <p class="section-title">2. Объём передаваемых прав</p>
      <p>
        Исключительное право передаётся без ограничения по территории использования и без ограничения
        по сроку действия. С момента полной оплаты Правообладатель утрачивает любые права на дальнейшее
        использование, воспроизведение, публикацию, переработку, распространение, отчуждение,
        перепродажу или иное распоряжение указанным битом.
      </p>
      <p>
        После перехода исключительного права Приобретатель становится единственным и полным обладателем
        прав на указанный бит и вправе использовать его по своему усмотрению в пределах действующего
        законодательства.
      </p>

      <p class="section-title">3. Гарантии Правообладателя</p>
      <p>
        Правообладатель подтверждает, что на дату заключения настоящего договора он обладает
        исключительным правом на бит «${escapeHtml(data.beat_title)}», не отчуждал его третьим лицам,
        не предоставлял права использования на условиях, препятствующих настоящему отчуждению,
        и вправе заключить настоящий договор.
      </p>

      <p class="section-title">4. Цена и расчёты</p>
      <p>
        Цена отчуждения исключительного права составляет ${escapeHtml(data.price)}.
        Валюта расчёта: ${escapeHtml(data.currency)}. Переход исключительного права осуществляется
        с момента полной оплаты по настоящему договору.
      </p>

      <p class="section-title">5. Данные Приобретателя</p>
      <div class="details-box">
        <p><strong>ФИО:</strong> ${buyerFullName}</p>
        <p><strong>Город:</strong> ${buyerCity}</p>
        <p><strong>Псевдоним артиста:</strong> ${buyerStageName}</p>
        <p><strong>Паспортные данные:</strong> <span class="fill-line">&nbsp;</span></p>
      </div>

      <p class="section-title">6. Заключительные положения</p>
      <p>
        Настоящий договор подтверждает полное и окончательное отчуждение исключительных прав.
        Все споры и разногласия стороны стремятся урегулировать путём переговоров.
      </p>

      <div class="signatures">
        <p><strong>Реквизиты и подписи сторон</strong></p>
        <div class="signature-grid">
          <div>
            <p class="signature-label"><strong>Правообладатель:</strong><br />${escapeHtml(data.seller_name)}</p>
            <p class="small">${escapeHtml(data.seller_city)}, ${escapeHtml(data.seller_country)}</p>
            <p class="small">${escapeHtml(data.seller_email)} · ${escapeHtml(data.seller_telegram)}</p>
            ${sellerSignature}
            <p>Подпись: ____________________</p>
          </div>
          <div>
            <p class="signature-label"><strong>Приобретатель:</strong><br />${buyerFullName}</p>
            <p class="small">Город: ${buyerCity}</p>
            <p class="small">Псевдоним: ${buyerStageName}</p>
            <p>Подпись: ____________________</p>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>`;
}
