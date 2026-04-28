import { computeSettlement, parseSplit, type ParsedParticipant, type SplitFormValues, type SplitMode } from "./splitter";
import { t } from "../i18n";

export type PdfExportPerson = {
  participantId: string;
  name: string;
  isPayer: boolean;
  paidCents: number;
  consumedCents: number;
  netCents: number;
};

export type PdfExportItemShare = {
  participantId: string;
  name: string;
  amountCents: number;
};

export type PdfExportItem = {
  id: string;
  name: string;
  amountCents: number;
  splitMode: SplitMode;
  splitModeLabel: string;
  shares: PdfExportItemShare[];
};

export type PdfExportPersonItemShare = {
  itemId: string;
  itemName: string;
  amountCents: number;
};

export type PdfExportPersonBreakdown = {
  participantId: string;
  name: string;
  totalAmountCents: number;
  items: PdfExportPersonItemShare[];
};

export type PdfExportData = {
  appName: string;
  splitTitle: string;
  exportDateLabel: string;
  fileName: string;
  currency: string;
  totalCents: number;
  note: string;
  payer: PdfExportPerson;
  people: PdfExportPerson[];
  items: PdfExportItem[];
  personBreakdown: PdfExportPersonBreakdown[];
};

function comparePeopleByDisplayOrder<T extends { name: string; isPayer: boolean }>(left: T, right: T) {
  if (left.isPayer !== right.isPayer) {
    return left.isPayer ? -1 : 1;
  }

  return left.name.localeCompare(right.name, "en-US", { sensitivity: "base" });
}

function formatExportDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

function slugifySplitName(splitName?: string) {
  const normalized = splitName?.trim().toLowerCase() ?? "";
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug;
}

function getPdfTitle(splitName?: string) {
  const trimmedName = splitName?.trim();
  return trimmedName && trimmedName.length > 0
    ? t("pdf.title.named", { splitName: trimmedName })
    : t("pdf.title.default");
}

export function buildPdfFilename(splitName?: string, date = new Date()) {
  const year = date.getFullYear();
  const month = formatDatePart(date.getMonth() + 1);
  const day = formatDatePart(date.getDate());
  const slug = slugifySplitName(splitName);

  return slug.length > 0
    ? `${slug}-${year}-${month}-${day}.pdf`
    : `split-bill-${year}-${month}-${day}.pdf`;
}

function getSplitModeLabel(splitMode: SplitMode) {
  switch (splitMode) {
    case "even":
      return t("pdf.mode.even");
    case "shares":
      return t("pdf.mode.shares");
    case "percent":
      return t("pdf.mode.percent");
  }
}

function getParticipantName(participantId: string, participants: ParsedParticipant[]) {
  return participants.find((participant) => participant.id === participantId)?.name ?? t("pdf.unknownParticipant");
}

export function buildPdfExportData(values: SplitFormValues, date = new Date(), locale = "en-US"): PdfExportData {
  const settlement = computeSettlement(values);
  const parsed = parseSplit(values);

  if (!settlement.ok || !parsed.ok) {
    throw new Error(t("pdf.invalid"));
  }

  const payer = settlement.data.people.find((person) => person.isPayer)!;

  const items = parsed.data.items.map((item) => ({
    id: item.id,
    name: item.name,
    amountCents: item.amountCents,
    splitMode: item.splitMode,
    splitModeLabel: getSplitModeLabel(item.splitMode),
    shares: item.shares
      .filter((share) => share.amountCents !== 0)
      .map((share) => ({
        participantId: share.participantId,
        name: getParticipantName(share.participantId, parsed.data.participants),
        amountCents: share.amountCents,
      })),
  }));

  const personBreakdown = [...settlement.data.people]
    .sort(comparePeopleByDisplayOrder)
    .map((person) => {
      const personItems = items
        .map((item) => {
          const personShare = item.shares.find(
            (share) => share.participantId === person.participantId,
          );
          if (!personShare) {
            return null;
          }

          return {
            itemId: item.id,
            itemName: item.name,
            amountCents: personShare.amountCents,
          };
        })
        .filter((item): item is PdfExportPersonItemShare => item !== null);

      const totalAmountCents = personItems.reduce(
        (sum, item) => sum + item.amountCents,
        0,
      );

      return {
        participantId: person.participantId,
        name: person.name,
        totalAmountCents,
        items: personItems,
      };
    });

  const people = [...settlement.data.people].sort(comparePeopleByDisplayOrder).map((person) => ({
    participantId: person.participantId,
    name: person.name,
    isPayer: person.isPayer,
    paidCents: person.paidCents,
    consumedCents: person.consumedCents,
    netCents: person.netCents,
  }));

  return {
    appName: t("app.name"),
    splitTitle: getPdfTitle(values.splitName),
    exportDateLabel: formatExportDate(date, locale),
    fileName: buildPdfFilename(values.splitName, date),
    currency: settlement.data.currency,
    totalCents: settlement.data.totalCents,
    note: t("pdf.note"),
    payer,
    people,
    items,
    personBreakdown,
  };
}
