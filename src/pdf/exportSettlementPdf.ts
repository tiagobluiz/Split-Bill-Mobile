import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";

import { type PdfExportData } from "../domain";
import { buildPdfExportData } from "../domain/pdfExport";
import { formatMoney, type SplitFormValues } from "../domain/splitter";
import { t } from "../i18n";

const PDF_HEADER_ASSET = require("../../assets/split-bill-pdf-header.png");
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
  return Number.isFinite(rate) ? rate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") : "1";
}

function getPdfDocumentLanguage(locale: string) {
  return locale.split(/[-_]/)[0] || "en";
}

function normalizeUriForExpoFileSystem(uri: string) {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uri)) {
    return uri;
  }
  if (uri.startsWith("//")) {
    return `file:${uri}`;
  }
  if (uri.startsWith("/")) {
    return `file://${uri}`;
  }
  return uri;
}

function buildHeaderAssetUriCandidates(localUri: string, assetUri: string) {
  const candidates = [
    localUri,
    normalizeUriForExpoFileSystem(localUri),
    assetUri,
    normalizeUriForExpoFileSystem(assetUri),
  ].filter((uri) => uri && uri.trim()) as string[];

  return [...new Set(candidates)];
}

function normalizeBase64Payload(value: string) {
  const trimmed = value.trim();
  const marker = "base64,";
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex >= 0) {
    return trimmed.slice(markerIndex + marker.length);
  }
  return trimmed;
}

async function readBase64FromUri(uri: string) {
  try {
    const imageFile = new File(uri);
    const value = imageFile.base64Sync();
    return normalizeBase64Payload(value);
  } catch {
    const value = await LegacyFileSystem.readAsStringAsync(uri, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    return normalizeBase64Payload(value);
  }
}

async function getPdfHeaderImageSource(): Promise<string> {
  let localUriForLog = "";
  let assetUriForLog = "";
  let attemptedUrisForLog: string[] = [];
  try {
    const asset = Asset.fromModule(PDF_HEADER_ASSET);
    await asset.downloadAsync();
    localUriForLog = asset.localUri ?? "";
    assetUriForLog = asset.uri ?? "";
    const candidateUris = buildHeaderAssetUriCandidates(
      localUriForLog,
      assetUriForLog,
    );
    attemptedUrisForLog = candidateUris;
    if (!candidateUris.length) {
      throw new Error("PDF header image asset URI is unavailable.");
    }

    for (const uri of candidateUris) {
      const base64 = await readBase64FromUri(uri).catch(() => "");
      if (base64) {
        return `data:image/png;base64,${base64}`;
      }
    }

    throw new Error("PDF header image asset base64 payload is empty.");
  } catch (error) {
    console.warn("Failed to load PDF header image asset", {
      localUri: localUriForLog,
      assetUri: assetUriForLog,
      attemptedUris: attemptedUrisForLog,
      error,
    });
    throw new Error("Failed to load PDF header image asset.");
  }
}

function renderHeaderImage(imageSource: string, altText: string) {
  return `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(altText)}" />`;
}

export function renderSettlementPdfHtml(
  data: PdfExportData,
  locale = "en-US",
  headerImageSource?: string,
) {
  const totalCurrency = data.exchangeRate?.targetCurrency ?? data.currency;
  const totalRate = data.exchangeRate?.rate ?? 1;
  const totalCentsDisplay = convertCents(data.totalCents, totalRate);
  const payerPaidDisplay = convertCents(data.payer.paidCents, totalRate);
  const payerNetDisplay = convertCents(data.payer.netCents, totalRate);
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
            formatPdfMoney(
              convertCents(Math.abs(person.netCents), totalRate),
              totalCurrency,
              locale,
            ),
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
                formatPdfMoney(
                  convertCents(share.amountCents, totalRate),
                  totalCurrency,
                  locale,
                ),
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
              formatPdfMoney(
                convertCents(item.amountCents, totalRate),
                totalCurrency,
                locale,
              ),
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
                formatPdfMoney(
                  convertCents(item.amountCents, totalRate),
                  totalCurrency,
                  locale,
                ),
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
              formatPdfMoney(
                convertCents(person.totalAmountCents, totalRate),
                totalCurrency,
                locale,
              ),
            )}</div>
          </div>
          ${items}
        </div>
      `;
    })
    .join("");

  const brandedHeader = headerImageSource
    ? `
      <div class="brand-banner">
        ${renderHeaderImage(headerImageSource, data.appName)}
      </div>
    `
    : "";
  const fxMetaRow =
    data.exchangeRate &&
    data.exchangeRate.sourceCurrency !== data.exchangeRate.targetCurrency
      ? `
          <div class="meta-grid meta-grid-secondary">
            <div class="meta-card">
              <p class="meta-label">${escapeHtml(t("pdf.fx.originalCurrency"))}</p>
              <p class="meta-value">${escapeHtml(data.exchangeRate.sourceCurrency)}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">${escapeHtml(t("pdf.fx.targetCurrency"))}</p>
              <p class="meta-value">${escapeHtml(data.exchangeRate.targetCurrency)}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">${escapeHtml(t("pdf.fx.rateUsed"))}</p>
              <p class="meta-value">${escapeHtml(
                `1 ${data.exchangeRate.sourceCurrency} = ${formatFxRate(data.exchangeRate.rate)} ${data.exchangeRate.targetCurrency}`,
              )}</p>
            </div>
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
        .meta-grid-secondary {
          margin-top: 8px;
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
              <p class="meta-label">${escapeHtml(t("pdf.summary.total"))}</p>
              <p class="meta-value">${escapeHtml(formatPdfMoney(totalCentsDisplay, totalCurrency, locale))}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">${escapeHtml(t("pdf.summary.participants"))}</p>
              <p class="meta-value">${escapeHtml(String(data.people.length))}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">${escapeHtml(t("pdf.summary.items"))}</p>
              <p class="meta-value">${escapeHtml(String(data.items.length))}</p>
            </div>
          </div>
          ${fxMetaRow}
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
                paid: formatPdfMoney(payerPaidDisplay, totalCurrency, locale),
                collect: formatPdfMoney(payerNetDisplay, totalCurrency, locale),
              }),
            )}
          </p>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">${escapeHtml(t("pdf.section.whoOwes"))}</h2>
        <div class="owes-list">${owesRows}</div>
      </section>

      <section class="section">
        <h2 class="section-title">${escapeHtml(t("pdf.section.personBreakdown"))}</h2>
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

export type BuildSettlementPdfFileOptions = {
  allowHeaderlessWhenAssetUnavailable?: boolean;
};

export async function buildSettlementPdfFile(
  values: SplitFormValues,
  locale = "en-US",
  options: BuildSettlementPdfFileOptions = {},
): Promise<{ uri: string; fileName: string }> {
  const data = buildPdfExportData(values, new Date(), locale);
  const allowHeaderlessFallback =
    options.allowHeaderlessWhenAssetUnavailable ?? true;
  let headerImageSource: string | undefined;
  try {
    headerImageSource = await getPdfHeaderImageSource();
  } catch (error) {
    if (!allowHeaderlessFallback) {
      throw error;
    }
    console.warn(
      "Proceeding with headerless PDF export because fallback was explicitly enabled",
      error,
    );
  }
  const html = renderSettlementPdfHtml(data, locale, headerImageSource);
  const { uri } = await Print.printToFileAsync({
    html,
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
  const existingUris = await LegacyFileSystem.StorageAccessFramework.readDirectoryAsync(
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

async function copyFileToSafUri(sourceFileUri: string, destinationSafFileUri: string) {
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
  allowHeaderlessWhenAssetUnavailable?: boolean;
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
  const generatedPdf = await buildSettlementPdfFile(values, locale, {
    allowHeaderlessWhenAssetUnavailable:
      options.allowHeaderlessWhenAssetUnavailable,
  });
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
  options: BuildSettlementPdfFileOptions = {},
): Promise<void> {
  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error(t("pdf.sharingUnavailable"));
  }

  const pdfFile = await buildSettlementPdfFile(values, locale, options);
  await Sharing.shareAsync(pdfFile.uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: pdfFile.fileName,
  });
}
