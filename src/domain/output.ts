import { computeSettlement, formatMoney, removeSingleTrailingBlankItem, type SplitFormValues } from "./splitter";
import { t } from "../i18n";

function comparePeopleBySummaryOrder(left: { name: string; isPayer: boolean }, right: { name: string; isPayer: boolean }) {
  if (left.isPayer !== right.isPayer) {
    return left.isPayer ? -1 : 1;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

function getClipboardSummaryTitle(values: SplitFormValues) {
  const splitName = values.splitName?.trim();
  return splitName
    ? t("clipboard.title.named", { splitName })
    : t("clipboard.title.default");
}

export function buildClipboardSummary(
  values: SplitFormValues,
  locale = "en-US",
  options?: { settledParticipantIds?: string[] }
) {
  const normalized = removeSingleTrailingBlankItem(values);
  const settlement = computeSettlement(normalized);
  if (!settlement.ok) {
    return null;
  }

  const settledIds = new Set(options?.settledParticipantIds ?? []);
  const people = [...settlement.data.people]
    .map((person) => {
      if (!person.isPayer && settledIds.has(person.participantId)) {
        return {
          ...person,
          netCents: 0,
        };
      }

      return person;
    })
    .sort(comparePeopleBySummaryOrder);
  const adjustedPeople = people.map((person) => {
    if (!person.isPayer) {
      return person;
    }

    const nonPayerNetCents = people
      .filter((entry) => !entry.isPayer)
      .reduce((sum, entry) => sum + entry.netCents, 0);

    return {
      ...person,
      netCents: -nonPayerNetCents,
    };
  });
  const lines = [getClipboardSummaryTitle(normalized)];

  adjustedPeople.forEach((person) => {
    if (person.isPayer) {
      if (person.netCents > 0) {
        lines.push(
          t("clipboard.payer.getBack", {
            name: person.name,
            amount: formatMoney(person.paidCents, settlement.data.currency, locale),
            net: formatMoney(person.netCents, settlement.data.currency, locale),
          }),
        );
      } else if (person.netCents < 0) {
        lines.push(
          t("clipboard.payer.stillOwes", {
            name: person.name,
            amount: formatMoney(person.paidCents, settlement.data.currency, locale),
            net: formatMoney(Math.abs(person.netCents), settlement.data.currency, locale),
          }),
        );
      } else {
        lines.push(
          t("clipboard.payer.paidOnly", {
            name: person.name,
            amount: formatMoney(person.paidCents, settlement.data.currency, locale),
          }),
        );
      }
      return;
    }

    if (person.netCents === 0) {
      return;
    }

    if (person.netCents < 0) {
      lines.push(
        t("clipboard.person.owes", {
          name: person.name,
          amount: formatMoney(Math.abs(person.netCents), settlement.data.currency, locale),
        }),
      );
      return;
    }

    lines.push(
      t("clipboard.person.getsBack", {
        name: person.name,
        amount: formatMoney(person.netCents, settlement.data.currency, locale),
      }),
    );
  });

  return lines.join("\n");
}
