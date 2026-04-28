import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

import { type PdfExportData } from "../domain";
import { buildPdfExportData } from "../domain/pdfExport";
import { formatMoney, type SplitFormValues } from "../domain/splitter";
import { t } from "../i18n";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPdfMoney(amountCents: number, currency: string, locale: string) {
  return formatMoney(amountCents, currency, locale);
}

function getPdfDocumentLanguage(locale: string) {
  return locale.split(/[-_]/)[0] || "en";
}

export function renderSettlementPdfHtml(
  data: PdfExportData,
  locale = "en-US",
) {
  const lang = getPdfDocumentLanguage(locale);
  const nonPayers = data.people.filter(
    (person) => !person.isPayer && person.netCents < 0,
  );

  const owesRows = nonPayers
    .map(
      (person, index) => `
        <div class="row ${index === nonPayers.length - 1 ? "last-row" : ""}">
          <div class="cell name-cell">${escapeHtml(person.name)}</div>
          <div class="cell amount-cell">${escapeHtml(
            formatPdfMoney(Math.abs(person.netCents), data.currency, locale),
          )}</div>
        </div>
      `,
    )
    .join("");

  const itemCards = data.items
    .map((item) => {
      const shares = item.shares
        .map(
          (share) => `
            <div class="share-row">
              <div>${escapeHtml(share.name)}</div>
              <div>${escapeHtml(
                formatPdfMoney(share.amountCents, data.currency, locale),
              )}</div>
            </div>
          `,
        )
        .join("");

      return `
        <div class="item-card">
          <div class="item-header">
            <div class="item-title">${escapeHtml(item.name)}</div>
            <div class="item-title">${escapeHtml(
              formatPdfMoney(item.amountCents, data.currency, locale),
            )}</div>
          </div>
          <div class="item-meta">${escapeHtml(item.splitModeLabel)}</div>
          ${shares}
        </div>
      `;
    })
    .join("");

  const personBreakdownCards = data.personBreakdown
    .map((person) => {
      const items = person.items
        .map(
          (item) => `
            <div class="share-row">
              <div>${escapeHtml(item.itemName)}</div>
              <div>${escapeHtml(
                formatPdfMoney(item.amountCents, data.currency, locale),
              )}</div>
            </div>
          `,
        )
        .join("");

      return `
        <div class="item-card">
          <div class="item-header">
            <div class="item-title">${escapeHtml(person.name)}</div>
            <div class="item-title">${escapeHtml(
              formatPdfMoney(person.totalAmountCents, data.currency, locale),
            )}</div>
          </div>
          ${items}
        </div>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
  <html lang="${escapeHtml(lang)}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(data.fileName)}</title>
      <style>
        @page {
          margin: 32px;
          size: A4;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 10px;
          line-height: 1.45;
          color: #1d1d1f;
          background: #fffdfc;
        }

        .header {
          margin-bottom: 20px;
          padding-bottom: 14px;
          border-bottom: 1px solid #f2c7bb;
        }

        .title {
          margin: 0 0 6px;
          font-size: 24px;
          font-weight: 700;
        }

        .subtitle {
          margin: 0;
          font-size: 10px;
          color: #5a5a61;
        }

        .section {
          margin-bottom: 18px;
        }

        .section-title {
          margin: 0 0 10px;
          font-size: 14px;
          font-weight: 700;
        }

        .section-note {
          margin-top: 6px;
          font-size: 9px;
          color: #6e6e73;
        }

        .label {
          margin-bottom: 3px;
          font-size: 9px;
          color: #6e6e73;
        }

        .payer-card {
          margin-bottom: 12px;
          padding: 14px;
          border: 1px solid #f05d3d;
          border-radius: 10px;
          background: #ffffff;
        }

        .payer-name {
          margin: 0 0 4px;
          font-size: 18px;
          font-weight: 700;
        }

        .payer-summary {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          color: #f05d3d;
        }

        .owes-list {
          border: 1px solid #eed7cf;
          border-radius: 10px;
          overflow: hidden;
          background: #ffffff;
        }

        .row {
          display: flex;
          border-bottom: 1px solid #f3e6e1;
        }

        .last-row {
          border-bottom: 0;
        }

        .cell {
          flex-grow: 1;
          padding: 9px 10px;
        }

        .name-cell {
          flex-basis: 70%;
        }

        .amount-cell {
          flex-basis: 30%;
          text-align: right;
        }

        .item-card {
          margin-bottom: 10px;
          padding: 12px;
          border: 1px solid #eed7cf;
          border-radius: 10px;
          background: #ffffff;
          page-break-inside: avoid;
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 6px;
        }

        .item-title {
          font-size: 12px;
          font-weight: 700;
        }

        .item-meta {
          margin-bottom: 8px;
          font-size: 9px;
          color: #6e6e73;
        }

        .share-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">${escapeHtml(data.appName)}</h1>
        <p class="subtitle">${escapeHtml(data.splitTitle || t("pdf.title.default"))}</p>
        <p class="subtitle">${escapeHtml(
          t("common.exportedOn", { date: data.exportDateLabel }),
        )}</p>
        <p class="subtitle">${escapeHtml(
          t("common.currencyLabel", { currency: data.currency }),
        )}</p>
      </div>

      <section class="section">
        <h2 class="section-title">${escapeHtml(t("pdf.section.finalSettlement"))}</h2>
        <div class="payer-card">
          <div class="label">${escapeHtml(t("pdf.payerLabel"))}</div>
          <p class="payer-name">${escapeHtml(data.payer.name)}</p>
          <p class="payer-summary">
            ${escapeHtml(
              t("pdf.payerSummary", {
                paid: formatPdfMoney(data.payer.paidCents, data.currency, locale),
                collect: formatPdfMoney(data.payer.netCents, data.currency, locale),
              }),
            )}
          </p>
        </div>
        <div class="section-note">
          ${escapeHtml(
            t("pdf.totalReceipt", {
              amount: formatPdfMoney(data.totalCents, data.currency, locale),
            }),
          )}
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">${escapeHtml(t("pdf.section.whoOwes"))}</h2>
        <div class="owes-list">${owesRows}</div>
      </section>

      <section class="section">
        <h2 class="section-title">${escapeHtml(t("pdf.section.itemBreakdown"))}</h2>
        <div class="section-note">${escapeHtml(data.note)}</div>
        ${itemCards}
      </section>

      <section class="section">
        <h2 class="section-title">${escapeHtml(t("pdf.section.personBreakdown"))}</h2>
        <div class="section-note">${escapeHtml(data.note)}</div>
        ${personBreakdownCards}
      </section>
    </body>
  </html>`;
}

export async function exportSettlementPdf(
  values: SplitFormValues,
  locale = "en-US",
): Promise<void> {
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error(t("pdf.sharingUnavailable"));
  }

  const data = buildPdfExportData(values, new Date(), locale);
  const html = renderSettlementPdfHtml(data, locale);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const sourceFile = new File(uri);
  const destinationFile = new File(Paths.document, data.fileName);
  if (destinationFile.exists) {
    destinationFile.delete();
  }
  try {
    sourceFile.copy(destinationFile);
  } finally {
    if (sourceFile.exists) {
      sourceFile.delete();
    }
  }

  await Sharing.shareAsync(destinationFile.uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: data.fileName,
  });
}
