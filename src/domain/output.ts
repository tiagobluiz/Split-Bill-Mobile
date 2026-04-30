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
  options?: { settledParticipantIds?: string[]; appCurrency?: string }
) {
  const normalized = removeSingleTrailingBlankItem(values);
  const settlement = computeSettlement(normalized);
  if (!settlement.ok) {
    return null;
  }
  const sourceCurrency = normalized.currency.trim().toUpperCase();
  const targetCurrency = options?.appCurrency?.trim().toUpperCase() || sourceCurrency;
  const fx = normalized.exchangeRate;
  const rate =
    sourceCurrency === targetCurrency
      ? 1
      : fx &&
          fx.sourceCurrency.trim().toUpperCase() === sourceCurrency &&
          fx.targetCurrency.trim().toUpperCase() === targetCurrency &&
          Number.isFinite(fx.rate) &&
          fx.rate > 0
        ? fx.rate
        : 1;
  const money = (amountCents: number) =>
    formatMoney(Math.round(amountCents * rate), targetCurrency, locale);

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
            amount: money(person.paidCents),
            net: money(person.netCents),
          }),
        );
      } else if (person.netCents < 0) {
        lines.push(
          t("clipboard.payer.stillOwes", {
            name: person.name,
            amount: money(person.paidCents),
            net: money(Math.abs(person.netCents)),
          }),
        );
      } else {
        lines.push(
          t("clipboard.payer.paidOnly", {
            name: person.name,
            amount: money(person.paidCents),
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
          amount: money(Math.abs(person.netCents)),
        }),
      );
      return;
    }

    lines.push(
      t("clipboard.person.getsBack", {
        name: person.name,
        amount: money(person.netCents),
      }),
    );
  });

  return lines.join("\n");
}
