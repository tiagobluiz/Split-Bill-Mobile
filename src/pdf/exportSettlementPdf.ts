import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";

import { type PdfExportData } from "../domain";
import { buildPdfExportData } from "../domain/pdfExport";
import { formatMoney, type SplitFormValues } from "../domain/splitter";
import { t } from "../i18n";

const PDF_HEADER_ASSET = require("../../assets/split-bill-pdf-header.png");

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPdfMoney(amountCents: number, currency: string, locale: string) {
  return formatMoney(amountCents, currency, locale);
}

function getPdfDocumentLanguage(locale: string) {
  return locale.split(/[-_]/)[0] || "en";
}

async function getPdfHeaderImageDataUri() {
  const asset = Asset.fromModule(PDF_HEADER_ASSET);
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error("Unable to load PDF header image asset.");
  }

  const imageFile = new File(asset.localUri);
  const base64 = imageFile.base64Sync();
  return `data:image/png;base64,${base64}`;
}

export function renderSettlementPdfHtml(
  data: PdfExportData,
  locale = "en-US",
  headerImageDataUri?: string,
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

  const brandedHeader = headerImageDataUri
    ? `
      <div class="brand-banner">
        <img src="${escapeHtml(headerImageDataUri)}" alt="${escapeHtml(data.appName)}" />
      </div>
    `
    : "";

  return `<!DOCTYPE html>
  <html lang="${escapeHtml(lang)}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(data.fileName)}</title>
      <style>
        @page {
          margin: 28px;
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
          color: #1f2933;
          background: #f9fafb;
        }

        .header {
          margin-bottom: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          background: #ffffff;
        }

        .brand-banner {
          width: 100%;
          background: #a54206;
        }

        .brand-banner img {
          display: block;
          width: 100%;
          height: auto;
        }

        .header-content {
          padding: 14px 16px 12px;
        }

        .title {
          margin: 0;
          font-size: 22px;
          line-height: 1.2;
          font-weight: 800;
          color: #111827;
          text-align: center;
        }

        .title-date {
          font-size: 13px;
          font-weight: 600;
          color: #5f6b7a;
        }

        .meta-grid {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .meta-card {
          padding: 8px;
          border-radius: 8px;
          background: #f7f8fa;
          border: 1px solid #eceff3;
        }

        .meta-label {
          margin: 0 0 2px;
          font-size: 8px;
          color: #5f6b7a;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .meta-value {
          margin: 0;
          font-size: 10px;
          color: #1f2933;
          font-weight: 600;
        }

        .section {
          margin-bottom: 16px;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #ffffff;
        }

        .section-title {
          margin: 0 0 10px;
          font-size: 14px;
          font-weight: 800;
          color: #111827;
        }

        .section-note {
          margin-top: 6px;
          font-size: 9px;
          color: #5f6b7a;
        }

        .label {
          margin-bottom: 3px;
          font-size: 9px;
          color: #5f6b7a;
        }

        .payer-card {
          margin-bottom: 10px;
          padding: 14px;
          border: 1px solid #f59e0b;
          border-radius: 10px;
          background: #fff8eb;
        }

        .payer-name {
          margin: 0 0 4px;
          font-size: 18px;
          font-weight: 800;
          color: #111827;
        }

        .payer-summary {
          margin: 0;
          font-size: 12px;
          font-weight: 800;
          color: #9a3412;
        }

        .owes-list {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          background: #ffffff;
        }

        .row {
          display: flex;
          border-bottom: 1px solid #edf1f5;
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
          font-weight: 700;
        }

        .item-card {
          margin-bottom: 10px;
          padding: 12px;
          border: 1px solid #e6ebf1;
          border-radius: 10px;
          background: #ffffff;
          page-break-inside: avoid;
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 6px;
          padding-bottom: 6px;
          border-bottom: 1px solid #f1f5f9;
        }

        .item-title {
          font-size: 12px;
          font-weight: 800;
          color: #0f172a;
        }

        .item-meta {
          margin-bottom: 8px;
          font-size: 9px;
          color: #5f6b7a;
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
        ${brandedHeader}
        <div class="header-content">
          <h1 class="title">
            ${escapeHtml(data.splitName || t("pdf.title.default"))}
            <span class="title-date">(${escapeHtml(data.exportDateLabel)})</span>
          </h1>
          <div class="meta-grid">
            <div class="meta-card">
              <p class="meta-label">${escapeHtml(t("pdf.totalReceipt", { amount: "" }).replace(/\s+$/, ""))}</p>
              <p class="meta-value">${escapeHtml(formatPdfMoney(data.totalCents, data.currency, locale))}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">Participants</p>
              <p class="meta-value">${escapeHtml(String(data.people.length))}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">Items</p>
              <p class="meta-value">${escapeHtml(String(data.items.length))}</p>
            </div>
          </div>
        </div>
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
        <h2 class="section-title">${escapeHtml(t("pdf.section.personBreakdown"))}</h2>
        <div class="section-note">${escapeHtml(data.note)}</div>
        ${personBreakdownCards}
      </section>

      <section class="section">
        <h2 class="section-title">${escapeHtml(t("pdf.section.itemBreakdown"))}</h2>
        <div class="section-note">${escapeHtml(data.note)}</div>
        ${itemCards}
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
  const headerImageDataUri = await getPdfHeaderImageDataUri();
  const html = renderSettlementPdfHtml(data, locale, headerImageDataUri);
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
