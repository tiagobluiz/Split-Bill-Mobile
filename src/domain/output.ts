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
  const lines = ["Split Bill summary"];

  adjustedPeople.forEach((person) => {
    if (person.isPayer) {
      const paidLabel = `${person.name}: paid ${formatMoney(person.paidCents, settlement.data.currency, locale)}`;
      if (person.netCents > 0) {
        lines.push(
          `${paidLabel} and should get back ${formatMoney(person.netCents, settlement.data.currency, locale)}.`
        );
      } else if (person.netCents < 0) {
        lines.push(
          `${paidLabel} and still owes ${formatMoney(Math.abs(person.netCents), settlement.data.currency, locale)}.`
        );
      } else {
        lines.push(`${paidLabel}.`);
      }
      return;
    }

    if (person.netCents === 0) {
      return;
    }

    if (person.netCents < 0) {
      lines.push(`${person.name}: owes ${formatMoney(Math.abs(person.netCents), settlement.data.currency, locale)}.`);
      return;
    }

    lines.push(`${person.name}: gets back ${formatMoney(person.netCents, settlement.data.currency, locale)}.`);
  });

  return lines.join("\n");
}
