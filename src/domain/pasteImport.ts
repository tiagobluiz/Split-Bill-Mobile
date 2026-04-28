import { t } from "../i18n";

export type ReceiptImportItem = {
  name: string;
  price: string;
};

export type ReceiptImportWarning = {
  code: string;
  message: string;
};

export type ParsedPasteImportResult = {
  items: ReceiptImportItem[];
  warnings: ReceiptImportWarning[];
  ignoredLines: string[];
};

const PASTE_SUMMARY_LABELS = ["total", "subtotal", "tax", "vat", "paid", "payment", "cash", "card"];

function normalizePrice(rawValue: string) {
  const cleaned = rawValue
    .trim()
    .replace(/[\u20AC\u0024\u00A3]|eur|usd|gbp/gi, "")
    .replace(/\s+/g, "");

  if (!cleaned) {
    return null;
  }

  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;

  let normalized = cleaned;
  if (commaCount > 0 && dotCount > 0) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (commaCount > 0) {
    normalized = cleaned.replace(",", ".");
  }

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed.toFixed(2);
}

function parseLineFormat(line: string) {
  const trimmed = line.trim();
  const withoutPrefix = trimmed.replace(/^(?:[-*]\s*|\d+[.)]\s*)/, "").trim();
  const separatorMatch = withoutPrefix.match(/^(.*?)(?:\s+-\s+|:\s*)([-\d.,\s\u20AC\u0024\u00A3A-Za-z]+)$/);
  if (!separatorMatch) {
    return null;
  }

  const name = separatorMatch[1]?.trim();
  const price = normalizePrice(separatorMatch[2]);
  const normalizedName = name?.replace(/[:\-]+$/, "").trim().toLowerCase();
  if (
    !name ||
    !price ||
    !normalizedName ||
    PASTE_SUMMARY_LABELS.some((label) => normalizedName === label || normalizedName.startsWith(`${label} `))
  ) {
    return null;
  }

  return { name, price };
}

function parseCsvLine(line: string) {
  const parts = line
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  const [name, priceRaw] = parts;
  const lowerName = name.toLowerCase();
  const lowerPrice = priceRaw.toLowerCase();

  if ((lowerName === "item" || lowerName === "name") && (lowerPrice === "price" || lowerPrice === "amount")) {
    return null;
  }

  const price = normalizePrice(priceRaw);
  if (!name || !price) {
    return null;
  }

  return { name, price };
}

function parseTrailingPriceLine(line: string) {
  const trimmed = line.trim();
  const withoutPrefix = trimmed.replace(/^(?:[-*]\s*|\d+[.)]\s*)/, "").trim();
  const trailingPriceMatch = withoutPrefix.match(/^(.*\S)\s+([-\d.,\u20AC\u0024\u00A3A-Za-z]+)$/);
  if (!trailingPriceMatch) {
    return null;
  }

  const name = trailingPriceMatch[1]?.trim();
  const price = normalizePrice(trailingPriceMatch[2]);
  const normalizedName = name?.replace(/[:\-]+$/, "").trim().toLowerCase();

  if (
    !name ||
    !price ||
    !normalizedName ||
    PASTE_SUMMARY_LABELS.some((label) => normalizedName === label || normalizedName.startsWith(`${label} `))
  ) {
    return null;
  }

  return { name, price };
}

export function parsePastedItems(input: string): ParsedPasteImportResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const items: ReceiptImportItem[] = [];
  const ignoredLines: string[] = [];

  lines.forEach((line) => {
    const parsed = parseLineFormat(line) ?? parseCsvLine(line) ?? parseTrailingPriceLine(line);
    if (parsed) {
      items.push(parsed);
      return;
    }

    ignoredLines.push(line);
  });

  const warnings: ReceiptImportWarning[] = [];

  if (ignoredLines.length > 0) {
    warnings.push({
      code: "ignored-paste-lines",
      message:
        ignoredLines.length === 1
          ? t("pasteImport.ignoredLines.one", { count: ignoredLines.length })
          : t("pasteImport.ignoredLines.other", { count: ignoredLines.length }),
    });
  }

  if (items.length === 0) {
    warnings.push({
      code: "no-items-detected",
      message: t("pasteImport.noItemsDetected"),
    });
  }

  return {
    items,
    warnings,
    ignoredLines,
  };
}
