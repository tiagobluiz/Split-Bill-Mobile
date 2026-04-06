import { computeSettlement, formatMoney, removeSingleTrailingBlankItem, type SplitFormValues } from "./splitter";

function comparePeopleBySummaryOrder(left: { name: string; isPayer: boolean }, right: { name: string; isPayer: boolean }) {
  if (left.isPayer !== right.isPayer) {
    return left.isPayer ? -1 : 1;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
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
  const unsettledDebtCents = people
    .filter((person) => !person.isPayer && person.netCents < 0)
    .reduce((sum, person) => sum + Math.abs(person.netCents), 0);
  const lines = ["Split Bill summary"];

  people.forEach((person) => {
    if (person.isPayer) {
      lines.push(
        `${person.name}: paid ${formatMoney(person.paidCents, settlement.data.currency, locale)} and should get back ${formatMoney(
          unsettledDebtCents,
          settlement.data.currency,
          locale
        )}.`
      );
      return;
    }

    if (person.netCents === 0) {
      return;
    }

    lines.push(`${person.name}: owes ${formatMoney(Math.abs(person.netCents), settlement.data.currency, locale)}.`);
  });

  return lines.join("\n");
}
