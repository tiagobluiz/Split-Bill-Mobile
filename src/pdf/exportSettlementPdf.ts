import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Directory, File, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";

import { type PdfExportData } from "../domain";
import { buildPdfExportData } from "../domain/pdfExport";
import { resolveInvoicePhotoUri } from "../lib/invoicePhotoPaths";
import { formatMoney, type SplitFormValues } from "../domain/splitter";
import { t } from "../i18n";
import { PDF_HEADER_IMAGE_DATA_URI } from "./pdfHeaderImageDataUri.generated";

const DOWNLOAD_DUPLICATE_MAX_INDEX = 999;
const INTERNAL_FILE_NAME_MAX_INDEX = 999;

export class DirectoryPickerCancelledError extends Error {
  constructor() {
    super("Directory picker was cancelled by user.");
    this.name = "DirectoryPickerCancelledError";
  }
}

function isPickerCancellationError(error: unknown) {
  if (error instanceof DirectoryPickerCancelledError) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode =
    "code" in error && typeof error.code === "string"
      ? error.code.toLowerCase()
      : "";
  if (
    maybeCode === "err_canceled" ||
    maybeCode === "err_cancelled" ||
    maybeCode === "user_canceled" ||
    maybeCode === "user_cancelled"
  ) {
    return true;
  }

  const maybeMessage =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  const knownCancellationPhrases = [
    "cancelled by user",
    "canceled by user",
    "user cancelled",
    "user canceled",
    "picker cancelled",
    "picker canceled",
  ];
  return knownCancellationPhrases.some((phrase) =>
    maybeMessage.includes(phrase),
  );
}

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

function convertCents(amountCents: number, rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) {
    return amountCents;
  }
  return Math.round(amountCents * rate);
}

function formatFxRate(rate: number) {
  return Number.isFinite(rate)
    ? rate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")
    : "1";
}

function getPdfDocumentLanguage(locale: string) {
  return locale.split(/[-_]/)[0] || "en";
}

function renderHeaderImage(imageSource: string, altText: string) {
  return `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(altText)}" />`;
}

export type PdfAvatar = {
  initials: string;
  background: string;
  foreground: string;
  photoUri?: string;
};

export type PdfAvatarMap = Record<string, PdfAvatar>;

const PDF_ROW_MIN_HEIGHT = 35;
const PDF_LINE_HEIGHT = 14;
const PDF_CARD_CHROME_HEIGHT = 66; // Heading, borders, padding and following gap.
const PDF_BREAKDOWN_HEIGHT = Math.floor(((297 - 34 - 13) * 96) / 25.4) - 34;
// Reserve space for the section title and a small print-engine margin.

type BreakdownRow = { html: string; height: number };

function estimatedLines(label: string, width: number) {
  let lines = 1;
  let lineWidth = 0;
  for (const word of label.split(/\s+/)) {
    const wordWidth = Array.from(word).reduce(
      (sum, character) => sum + (/^[\x20-\x7e]$/.test(character) ? 12 : 24),
      0,
    );
    if (lineWidth && lineWidth + 12 + wordWidth > width) {
      lines += 1;
      lineWidth = 0;
    }
    const extraLines = Math.max(0, Math.ceil(wordWidth / width) - 1);
    lines += extraLines;
    lineWidth += (lineWidth ? 12 : 0) + wordWidth - extraLines * width;
  }
  return lines;
}

function breakdownRowHeight(...lineCounts: number[]) {
  return Math.max(
    PDF_ROW_MIN_HEIGHT,
    Math.max(...lineCounts) * PDF_LINE_HEIGHT + 11,
  );
}

export function renderSettlementPdfHtml(
  data: PdfExportData,
  locale = "en-US",
  headerImageDataUri: string | null | undefined = PDF_HEADER_IMAGE_DATA_URI,
  invoiceImageDataUri?: string,
  avatars: PdfAvatarMap = {},
) {
  const currency = data.exchangeRate?.targetCurrency ?? data.currency;
  const rate = data.exchangeRate?.rate ?? 1;
  const money = (cents: number) =>
    escapeHtml(formatPdfMoney(convertCents(cents, rate), currency, locale));
  const breakdownRow = (
    name: string,
    allocation: string,
    cents: number,
  ): BreakdownRow => {
    const amount = formatPdfMoney(convertCents(cents, rate), currency, locale);
    return {
      html: `<div class="row breakdown-row"><span class="grow">${escapeHtml(name)}</span><span class="allocation">${escapeHtml(allocation)}</span><strong>${escapeHtml(amount)}</strong></div>`,
      height: breakdownRowHeight(
        estimatedLines(name, 296),
        estimatedLines(allocation, 164),
        estimatedLines(amount, 150),
      ),
    };
  };
  const people = [...data.people].sort((a, b) =>
    a.name.localeCompare(b.name, locale, { sensitivity: "base" }),
  );
  const avatar = (id: string, name: string) => {
    const person = avatars[id];
    const initials =
      person?.initials ??
      name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
    const style = person
      ? ` style="background:${escapeHtml(person.background)};color:${escapeHtml(person.foreground)}"`
      : "";
    return person?.photoUri
      ? `<img class="avatar" src="${escapeHtml(person.photoUri)}" alt="">`
      : `<span class="avatar"${style}>${escapeHtml(initials)}</span>`;
  };
  const payerChip = (participantId: string) =>
    participantId === data.payer.participantId
      ? `<span class="payer-chip">${escapeHtml(t("pdf.payerLabel"))}</span>`
      : "";
  const personRows = people.map(
    (person) =>
      `<div class="row">${avatar(person.participantId, person.name)}<span class="person-heading grow"><span>${escapeHtml(person.name)}</span>${payerChip(person.participantId)}</span><strong>${money(person.consumedCents)}</strong></div>`,
  );
  const personCards = [...data.personBreakdown]
    .sort((a, b) =>
      a.name.localeCompare(b.name, locale, { sensitivity: "base" }),
    )
    .map((person) => {
      const displayedTotal = convertCents(person.totalAmountCents, rate);
      const displayedItems = person.items.reduce(
        (sum, item) => sum + convertCents(item.amountCents, rate),
        0,
      );
      const adjustment = displayedTotal - displayedItems;
      const rows = person.items.map((item) =>
        breakdownRow(
          item.itemName,
          item.allocationLabel ?? "",
          item.amountCents,
        ),
      );
      if (!rows.length)
        rows.push({
          html: `<div class="row muted">${escapeHtml(t("pdf.noConsumption"))}</div>`,
          height: PDF_ROW_MIN_HEIGHT,
        });
      if (adjustment)
        rows.push({
          html: `<div class="row adjustment"><span class="grow">${escapeHtml(t("pdf.rounding"))}</span><strong>${adjustment > 0 ? "+" : "-"}${escapeHtml(formatPdfMoney(Math.abs(adjustment), currency, locale))}</strong></div>`,
          height: PDF_ROW_MIN_HEIGHT,
        });
      const chip = payerChip(person.participantId);
      return {
        title: `${avatar(person.participantId, person.name)}<span class="person-heading grow"><strong>${escapeHtml(person.name)}</strong>${chip}</span><strong>${escapeHtml(formatPdfMoney(displayedTotal, currency, locale))}</strong>`,
        headingHeight:
          PDF_CARD_CHROME_HEIGHT +
          (estimatedLines(person.name, chip ? 220 : 310) - 1) * PDF_LINE_HEIGHT,
        rows,
      };
    });
  const itemCards = data.items.map((item) => {
    const originalMoney = (cents: number) => formatPdfMoney(cents, data.currency, locale);
    const quantity = item.quantity ?? 1;
    const calculation = `${quantity} × ${originalMoney(item.unitPriceCents)}${item.discount ? ` = ${originalMoney(item.subtotalCents)}` : ""}`;
    const discount = item.discount
      ? `${item.discount.type === "percent" ? `${t("flow.itemDetail.discount")} (${item.discount.value}%)` : t("pdf.fixedDiscount")} = −${originalMoney(item.discount.amountCents)}${data.exchangeRate ? ` → ${originalMoney(item.amountCents)}` : ""}`
      : "";
    const showCalculation = quantity !== 1 || !!item.discount;
    const pricing = showCalculation ? [data.exchangeRate ? `${t("pdf.fx.originalCurrency")}: ${calculation}` : calculation, discount].filter(Boolean) : [];
    const participantCount = t(item.shares.length === 1 ? "pdf.itemParticipants.one" : "pdf.itemParticipants.other", { count: item.shares.length });
    const subtitle = `${item.splitModeLabel} · ${participantCount}`;
    return {
      title: `<div class="item-heading-left"><strong>${escapeHtml(item.name)}</strong><div class="item-subtitle">${escapeHtml(subtitle)}</div></div><div class="item-heading-price">${pricing.map((line, index) => `<div class="${index ? "item-discount" : "item-calculation"}">${escapeHtml(line)}</div>`).join("")}<strong>${money(item.amountCents)}</strong></div>`,
      itemHeading: true,
      headingHeight:
        PDF_CARD_CHROME_HEIGHT +
        Math.max(
          estimatedLines(item.name, 250) * PDF_LINE_HEIGHT + estimatedLines(subtitle, 250) * PDF_LINE_HEIGHT,
          20 + pricing.reduce((height, line) => height + estimatedLines(line, 200) * PDF_LINE_HEIGHT, 0),
        ),
      rows: item.shares.map((share) =>
        breakdownRow(
          share.name,
          item.splitMode === "even"
            ? t("pdf.allocation.shares.one", { count: 1 })
            : (share.allocationLabel ?? ""),
          share.amountCents,
        ),
      ),
    };
  });
  type ReportCard = {
    title: string;
    itemHeading?: boolean;
    headingHeight: number;
    rows: BreakdownRow[];
  };
  const continuation = escapeHtml(t("pdf.continued"));
  type ReportPage = { section: string; content: string };
  const buildCardPages = (title: string, cards: ReportCard[]) => {
    const pages: ReportPage[] = [];
    let contents = "";
    let remaining = PDF_BREAKDOWN_HEIGHT;
    const flush = () => {
      pages.push({ section: title, content: contents });
      contents = "";
      remaining = PDF_BREAKDOWN_HEIGHT;
    };
    for (const card of cards) {
      const fullHeight =
        card.headingHeight +
        card.rows.reduce((height, row) => height + row.height, 0);
      if (fullHeight <= PDF_BREAKDOWN_HEIGHT && fullHeight > remaining) flush();

      let offset = 0;
      do {
        if (
          card.headingHeight + (card.rows[offset]?.height ?? 0) > remaining &&
          contents
        )
          flush();
        let remainingRowsHeight = remaining - card.headingHeight;
        let end = offset;
        while (
          end < card.rows.length &&
          card.rows[end]!.height <= remainingRowsHeight
        ) {
          remainingRowsHeight -= card.rows[end]!.height;
          end += 1;
        }
        // A single unusually tall row must still make forward progress.
        if (end === offset && offset < card.rows.length) {
          remainingRowsHeight -= card.rows[end]!.height;
          end += 1;
        }
        const rows = card.rows
          .slice(offset, end)
          .map((row) => row.html)
          .join("");
        contents += `<article class="card"><div class="card-title${card.itemHeading ? " item-card-title" : ""}">${card.title}${offset ? `<span class="muted">${continuation}</span>` : ""}</div>${rows}</article>`;
        remaining = remainingRowsHeight;
        offset = end;
        if (offset < card.rows.length) flush();
      } while (offset < card.rows.length);
    }
    if (contents || !pages.length) flush();
    return pages.map((page, index) => ({
      ...page,
      content: `<h2>${escapeHtml(title)} · ${escapeHtml(t("pdf.pageOf", { page: index + 1, total: pages.length }))}</h2>${page.content}`,
    }));
  };

  const fx = data.exchangeRate
    ? `<p class="muted">${escapeHtml(t("pdf.fx.originalCurrency"))}: ${escapeHtml(data.exchangeRate.sourceCurrency)} · ${escapeHtml(t("pdf.fx.targetCurrency"))}: ${escapeHtml(currency)} · ${escapeHtml(t("pdf.fx.rateUsed"))}: 1 ${escapeHtml(data.exchangeRate.sourceCurrency)} = ${formatFxRate(rate)} ${escapeHtml(currency)}</p>`
    : "";
  const header = (section: string) => `<header class="page-header">
    ${headerImageDataUri ? renderHeaderImage(headerImageDataUri, data.appName) : ""}
    <div><strong>${escapeHtml(data.appName)}</strong><small>Share the moment, not the math</small></div>
    <span class="page-section">${escapeHtml(section)}</span>
  </header>`;
  const payerBalanceLabel =
    data.payer.netCents < 0 ? "pdf.repay" : "pdf.collect";
  const totalText = formatPdfMoney(
    convertCents(data.payer.paidCents, rate),
    currency,
    locale,
  );
  const totalFontSize = Math.max(
    14,
    Math.min(42, Math.floor(350 / Math.max(1, Array.from(totalText).length))),
  );
  const summary = `
    <h1>${escapeHtml(data.splitName || t("pdf.title.default"))}</h1>
    <p class="muted">${escapeHtml(t("pdf.summary.participants"))}: ${people.length} · ${escapeHtml(t("pdf.summary.items"))}: ${data.items.length} · ${escapeHtml(t("splitDetails.date"))}: ${escapeHtml(data.splitDateLabel ?? data.exportDateLabel)} · ${escapeHtml(t("pdf.exportedOn", { date: data.exportDateLabel }))}</p>
    <div class="summary">
      <div class="summary-total">
        <span class="summary-label">${escapeHtml(t("pdf.totalBill"))}</span>
        <strong style="font-size:${totalFontSize}px">${escapeHtml(totalText)}</strong>
      </div>
      <div class="summary-settlement">
        <span class="summary-label">${escapeHtml(t("pdf.paidBy"))}</span>
        <div class="summary-payer">
          ${avatar(data.payer.participantId, data.payer.name)}
          <strong>${escapeHtml(data.payer.name)}</strong>
        </div>
        <span class="summary-label">${escapeHtml(t(payerBalanceLabel))}</span>
        <strong class="summary-balance">${money(Math.abs(data.payer.netCents))}</strong>
      </div>
    </div>${fx}`;
  const overview = t("pdf.overview");
  const pages: ReportPage[] = [
    {
      section: overview,
      content: `${summary}<h2>${escapeHtml(t("pdf.consumption"))}</h2><div class="card consumption-card">${personRows.slice(0, 8).join("")}</div>`,
    },
  ];
  for (let index = 8; index < personRows.length; index += 16) {
    pages.push({
      section: overview,
      content: `<h2>${escapeHtml(t("pdf.consumption"))} · ${continuation}</h2><div class="card consumption-card">${personRows.slice(index, index + 16).join("")}</div>`,
    });
  }
  pages.push(...buildCardPages(t("pdf.section.personBreakdown"), personCards));
  pages.push(...buildCardPages(t("pdf.section.itemBreakdown"), itemCards));
  if (invoiceImageDataUri)
    pages.push({
      section: t("pdf.attachments"),
      content: `<h2>${escapeHtml(t("pdf.attachments"))}</h2><h3>${escapeHtml(t("pdf.invoice"))}</h3><img class="invoice" src="${escapeHtml(invoiceImageDataUri)}" alt="${escapeHtml(t("pdf.invoice"))}">`,
    });
  return `<!DOCTYPE html><html lang="${escapeHtml(getPdfDocumentLanguage(locale))}"><head><meta charset="utf-8"><title>${escapeHtml(data.fileName)}</title><style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; } body { margin:0; font: 11px -apple-system, BlinkMacSystemFont, sans-serif; color: #302822; }
    .page { width:210mm; height:297mm; padding: 10mm 14mm 12mm; position:relative; overflow:hidden; page-break-after:always; break-after:page; } .page:last-child { page-break-after:auto; break-after:auto; }
    .page-header { height: 16mm; display:flex; align-items:center; gap:10px; border-bottom:1px solid #ead8ca; color:#a34700; margin-bottom:8mm; }
    .page-header img { width: 36px; height: 36px; object-fit:contain; border-radius:8px; } .page-header strong { display:block; font-size:18px; } .page-header small { display:block; color:#71645d; font-size:9px; }
    .footer { position:absolute; bottom:8mm; left:14mm; right:14mm; border-top:1px solid #ead8ca; padding-top:4mm; text-align:right; color:#817269; }
    h1 { font-size:24px; margin: 0 0 8px; overflow-wrap:anywhere; } h2 { font-size:15px; margin: 0 0 10px; } .muted { color:#817269; font-size:10px; }
    .page-section { margin-left:auto; color:#71645d; font-size:9px; font-weight:700; text-transform:uppercase; text-align:right; }
    .summary { background:#f8ede6; border-radius:14px; padding:24px 20px; display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); margin:18px 0; }
    .summary-label { display:block; color:#71645d; font-size:10px; font-weight:700; text-transform:uppercase; }
    .summary strong { overflow-wrap:anywhere; }
    .summary-total { padding-right:20px; border-right:1px solid #dcc4b3; }
    .summary-total strong { display:block; margin-top:10px; color:#a34700; line-height:1.15; }
    .summary-settlement { padding-left:20px; display:grid; grid-template-columns:auto minmax(0, 1fr); align-items:center; column-gap:10px; row-gap:12px; }
    .summary-payer { display:flex; align-items:center; justify-content:flex-end; gap:8px; min-width:0; }
    .summary-payer strong { font-size:14px; text-align:right; min-width:0; }
    .summary-balance { min-width:0; text-align:right; color:#a34700; font-size:18px; }
    .row,.card-title { display:flex; align-items:center; gap:10px; min-height:${PDF_ROW_MIN_HEIGHT}px; line-height:${PDF_LINE_HEIGHT}px; padding:5px 0; border-bottom:1px solid #f0e5de; } .row:last-child { border-bottom:0; } .grow { flex:1; overflow-wrap:anywhere; } .avatar { width:26px; height:26px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; object-fit:cover; background:#f8ede6; color:#a34700; font-weight:bold; flex-shrink:0; }
    .breakdown-row { display:grid; grid-template-columns:minmax(0, 48fr) minmax(0, 27fr) minmax(0, 25fr); }
    .breakdown-row .allocation { color:#817269; text-align:left; overflow-wrap:anywhere; }
    .breakdown-row > strong { text-align:right; overflow-wrap:anywhere; }
    .card { border:1px solid #ead8ca; border-radius:12px; padding:10px 12px; margin-bottom:8px; } .consumption-card { padding-top:0; padding-bottom:0; } .card-title { padding-top:0; color:#a34700; } .item-card-title { align-items:flex-start; padding-bottom:12px; } .item-heading-left { flex:1; min-width:0; overflow-wrap:anywhere; } .item-subtitle { color:#88766b; font-size:10px; font-weight:normal; margin-top:5px; } .item-heading-price { flex:0 1 45%; min-width:0; text-align:right; overflow-wrap:anywhere; line-height:16px; } .item-heading-price > strong { display:block; font-size:16px; margin-top:3px; } .item-calculation, .item-discount { color:#88766b; font-size:10px; font-weight:normal; } .adjustment { color:#a34700; } .invoice { max-width:100%; max-height:225mm; object-fit:contain; }
    .person-heading { display:flex; align-items:center; flex-wrap:wrap; gap:6px; min-width:0; }
    .person-heading strong { overflow-wrap:anywhere; }
    .payer-chip { color:#9d4401; background:#f8ede6; border-radius:10px; padding:2px 7px; font-size:9px; font-weight:700; }
  </style></head><body>${pages.map(({ section, content }, index) => `<div class="page">${header(section)}${content}<footer class="footer">${escapeHtml(t("pdf.pageOf", { page: index + 1, total: pages.length }))}</footer></div>`).join("")}</body></html>`;
}

export async function buildSettlementPdfFile(
  values: SplitFormValues,
  locale = "en-US",
  avatars: PdfAvatarMap = {},
): Promise<{ uri: string; fileName: string }> {
  const data = buildPdfExportData(values, new Date(), locale);
  let invoiceImageDataUri: string | undefined;
  if (values.invoicePhotoUri) {
    try {
      const invoicePhotoUri =
        resolveInvoicePhotoUri(
          values.invoicePhotoUri,
          LegacyFileSystem.documentDirectory,
        ) ?? values.invoicePhotoUri;
      if (invoicePhotoUri.startsWith("data:image/")) {
        invoiceImageDataUri = invoicePhotoUri;
      } else {
        const encoded = await LegacyFileSystem.readAsStringAsync(
          invoicePhotoUri,
          { encoding: LegacyFileSystem.EncodingType.Base64 },
        );
        const mime = /\.png(?:\?|$)/i.test(invoicePhotoUri)
          ? "image/png"
          : /\.webp(?:\?|$)/i.test(invoicePhotoUri)
            ? "image/webp"
            : "image/jpeg";
        invoiceImageDataUri = `data:${mime};base64,${encoded}`;
      }
    } catch {
      const error = new Error(
        "Unable to read the invoice photo. Please choose the photo again and retry.",
      );
      error.name = "InvoicePhotoReadError";
      throw error;
    }
  }
  const embeddedAvatars: PdfAvatarMap = {};
  await Promise.all(
    Object.entries(avatars).map(async ([id, avatar]) => {
      let photoUri = avatar.photoUri;
      if (photoUri && !photoUri.startsWith("data:image/")) {
        try {
          const encoded = await LegacyFileSystem.readAsStringAsync(photoUri, {
            encoding: LegacyFileSystem.EncodingType.Base64,
          });
          const mime = /\.png(?:\?|$)/i.test(photoUri)
            ? "image/png"
            : /\.webp(?:\?|$)/i.test(photoUri)
              ? "image/webp"
              : "image/jpeg";
          photoUri = `data:${mime};base64,${encoded}`;
        } catch {
          photoUri = undefined;
        }
      }
      embeddedAvatars[id] = { ...avatar, photoUri };
    }),
  );
  const html = renderSettlementPdfHtml(
    data,
    locale,
    undefined,
    invoiceImageDataUri,
    embeddedAvatars,
  );
  const { uri } = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
    base64: false,
  });

  const sourceFile = new File(uri);
  const destinationFile = new File(Paths.document, data.fileName);
  const tempDestinationFile = buildUniqueInternalFileName(data.fileName, "tmp");
  try {
    sourceFile.copy(tempDestinationFile);
    if (destinationFile.exists) {
      destinationFile.delete();
    }
    tempDestinationFile.move(destinationFile);
  } catch (error) {
    if (tempDestinationFile.exists) {
      tempDestinationFile.delete();
    }
    throw error;
  } finally {
    if (sourceFile.exists) {
      sourceFile.delete();
    }
  }

  return {
    uri: destinationFile.uri,
    fileName: data.fileName,
  };
}

function splitFileNameAndExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0) {
    return {
      baseName: fileName,
      extension: "",
    };
  }

  return {
    baseName: fileName.slice(0, lastDot),
    extension: fileName.slice(lastDot),
  };
}

function createDuplicateSafeName(fileName: string, index: number) {
  if (index === 0) {
    return fileName;
  }

  const { baseName, extension } = splitFileNameAndExtension(fileName);
  return `${baseName} (${index})${extension}`;
}

function buildAvailableDestinationFile(
  directory: Directory,
  preferredFileName: string,
) {
  for (let index = 0; index <= DOWNLOAD_DUPLICATE_MAX_INDEX; index += 1) {
    const candidateName = createDuplicateSafeName(preferredFileName, index);
    const candidateFile = new File(directory, candidateName);
    if (!candidateFile.exists) {
      return {
        file: candidateFile,
        fileName: candidateName,
      };
    }
  }

  throw new Error("Could not create a unique PDF filename.");
}

function isSafTreeUri(uri: string) {
  return uri.startsWith("content://") && uri.includes("/tree/");
}

function decodeSafNameFromUri(uri: string) {
  const withoutQuery = uri.split("?")[0] ?? uri;
  const segments = withoutQuery.split("/");
  const lastSegment = segments[segments.length - 1] ?? "";
  try {
    const decoded = decodeURIComponent(lastSegment);
    const slashIndex = decoded.lastIndexOf("/");
    if (slashIndex >= 0 && slashIndex < decoded.length - 1) {
      return decoded.slice(slashIndex + 1);
    }
    return decoded;
  } catch {
    return lastSegment;
  }
}

async function buildAvailableDestinationNameForSafDirectory(
  directoryUri: string,
  preferredFileName: string,
) {
  const existingUris =
    await LegacyFileSystem.StorageAccessFramework.readDirectoryAsync(
      directoryUri,
    );
  const existingNames = new Set(
    existingUris.map((uri) => decodeSafNameFromUri(uri)),
  );

  for (let index = 0; index <= DOWNLOAD_DUPLICATE_MAX_INDEX; index += 1) {
    const candidateName = createDuplicateSafeName(preferredFileName, index);
    if (!existingNames.has(candidateName)) {
      return candidateName;
    }
  }

  throw new Error("Could not create a unique PDF filename in SAF directory.");
}

async function createSafDestinationFile(
  directoryUri: string,
  preferredFileName: string,
) {
  const firstCandidateName = await buildAvailableDestinationNameForSafDirectory(
    directoryUri,
    preferredFileName,
  );
  let startIndex = 0;
  if (firstCandidateName !== preferredFileName) {
    startIndex = 1;
  }

  for (
    let index = startIndex;
    index <= DOWNLOAD_DUPLICATE_MAX_INDEX;
    index += 1
  ) {
    const candidateName =
      startIndex === 0 && index === 0
        ? firstCandidateName
        : createDuplicateSafeName(preferredFileName, index);
    const { baseName } = splitFileNameAndExtension(candidateName);
    try {
      const destinationUri =
        await LegacyFileSystem.StorageAccessFramework.createFileAsync(
          directoryUri,
          baseName,
          "application/pdf",
        );
      return {
        fileUri: destinationUri,
        fileName: candidateName,
      };
    } catch (error) {
      if (!isFileAlreadyExistsError(error)) {
        throw error;
      }
    }
  }

  throw new Error("Could not create a unique PDF filename in SAF directory.");
}

function buildUniqueInternalFileName(fileName: string, suffix: string) {
  const { baseName, extension } = splitFileNameAndExtension(fileName);
  const timestamp = Date.now();
  for (let index = 0; index <= INTERNAL_FILE_NAME_MAX_INDEX; index += 1) {
    const serial = index === 0 ? "" : `-${index}`;
    const candidateName = `${baseName}${extension}.${suffix}-${timestamp}${serial}`;
    const candidateFile = new File(Paths.document, candidateName);
    if (!candidateFile.exists) {
      return candidateFile;
    }
  }

  throw new Error(`Could not create a unique ${suffix} file name.`);
}

function isFileAlreadyExistsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return message.includes("FileAlreadyExistsException");
}

async function copyFileWithLegacySafFallback(
  sourceFileUri: string,
  destinationFile: File,
): Promise<void> {
  try {
    new File(sourceFileUri).copy(destinationFile);
    return;
  } catch (error) {
    const destinationUri = destinationFile.uri;
    const isSafUri = destinationUri.startsWith("content://");
    if (!isSafUri) {
      throw error;
    }
  }

  await LegacyFileSystem.copyAsync({
    from: sourceFileUri,
    to: destinationFile.uri,
  });
}

async function copyFileToSafUri(
  sourceFileUri: string,
  destinationSafFileUri: string,
) {
  const sourceBase64 = await LegacyFileSystem.readAsStringAsync(sourceFileUri, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });
  await LegacyFileSystem.writeAsStringAsync(
    destinationSafFileUri,
    sourceBase64,
    {
      encoding: LegacyFileSystem.EncodingType.Base64,
    },
  );
}

function cleanupInternalCopy(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.warn("Failed to clean up internal PDF copy", error);
  }
}

export type DownloadSettlementPdfToDeviceOptions = {
  preferredDirectoryUri?: string;
  avatars?: PdfAvatarMap;
  pickDirectory?: (
    initialUri?: string,
  ) => Promise<{ uri?: string } | Directory | null | undefined>;
  onDirectoryPicked?: (directoryUri: string) => void | Promise<void>;
};

function tryResolvePreferredDirectory(preferredDirectoryUri?: string) {
  if (!preferredDirectoryUri) {
    return null;
  }

  try {
    const directory = new Directory(preferredDirectoryUri);
    if (!directory.exists) {
      return null;
    }
    directory.list();
    return directory;
  } catch (error) {
    console.warn("Failed to reuse previously selected PDF folder", error);
    return null;
  }
}

async function requestVisibleDirectory(
  preferredDirectoryUri: string | undefined,
  pickDirectory: (
    initialUri?: string,
  ) => Promise<{ uri?: string } | Directory | null | undefined>,
) {
  try {
    const selectedDirectory = await pickDirectory(preferredDirectoryUri);
    const uri = selectedDirectory?.uri;
    if (!uri || !uri.trim()) {
      throw new DirectoryPickerCancelledError();
    }
    return new Directory(uri);
  } catch (error) {
    if (isPickerCancellationError(error)) {
      throw new DirectoryPickerCancelledError();
    }
    throw error;
  }
}

export async function downloadSettlementPdfToDevice(
  values: SplitFormValues,
  locale = "en-US",
  options: DownloadSettlementPdfToDeviceOptions = {},
): Promise<{ uri: string; fileName: string; directoryUri: string }> {
  const generatedPdf = await buildSettlementPdfFile(
    values,
    locale,
    options.avatars,
  );
  const sourceFile = new File(generatedPdf.uri);
  const pickDirectory = options.pickDirectory ?? Directory.pickDirectoryAsync;

  const persistPickedDirectory = async (directoryUri: string) => {
    if (!options.onDirectoryPicked) {
      return;
    }

    try {
      await options.onDirectoryPicked(directoryUri);
    } catch (error) {
      console.warn("Failed to persist selected PDF folder URI", error);
    }
  };

  const copyIntoDirectory = async (directory: Directory) => {
    if (isSafTreeUri(directory.uri)) {
      const safDestination = await createSafDestinationFile(
        directory.uri,
        generatedPdf.fileName,
      );
      await copyFileToSafUri(generatedPdf.uri, safDestination.fileUri);
      return {
        uri: safDestination.fileUri,
        fileName: safDestination.fileName,
        directoryUri: directory.uri,
      };
    }

    const destination = buildAvailableDestinationFile(
      directory,
      generatedPdf.fileName,
    );
    await copyFileWithLegacySafFallback(generatedPdf.uri, destination.file);
    return {
      uri: destination.file.uri,
      fileName: destination.fileName,
      directoryUri: directory.uri,
    };
  };

  const preferredDirectory = tryResolvePreferredDirectory(
    options.preferredDirectoryUri,
  );
  if (preferredDirectory) {
    try {
      const saved = await copyIntoDirectory(preferredDirectory);
      await persistPickedDirectory(saved.directoryUri);
      cleanupInternalCopy(generatedPdf.uri);
      return saved;
    } catch (error) {
      console.warn(
        "Failed to write PDF into previously selected folder, reprompting user",
        error,
      );
    }
  }

  const selectedDirectory = await requestVisibleDirectory(
    options.preferredDirectoryUri,
    pickDirectory,
  );
  const saved = await copyIntoDirectory(selectedDirectory);
  await persistPickedDirectory(saved.directoryUri);
  cleanupInternalCopy(generatedPdf.uri);
  return saved;
}

export function isDirectoryPickerCancelledError(error: unknown) {
  return error instanceof DirectoryPickerCancelledError;
}

export async function exportSettlementPdf(
  values: SplitFormValues,
  locale = "en-US",
  avatars: PdfAvatarMap = {},
): Promise<void> {
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error(t("pdf.sharingUnavailable"));
  }

  const pdfFile = await buildSettlementPdfFile(values, locale, avatars);
  await Sharing.shareAsync(pdfFile.uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: pdfFile.fileName,
  });
}
