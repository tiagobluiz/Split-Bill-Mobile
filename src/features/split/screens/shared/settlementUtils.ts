import { computeSettlement, formatMoney, parseMoneyToCents } from "../../../../domain";
import type { DraftRecord } from "../../../../storage/records";
import type { SplitListAmountDisplay } from "../../../../storage/settings";
import { getDeviceLocale } from "../../../../lib/device";
import { PALETTE } from "../../../../theme/palette";
import { t } from "../../../../i18n";
import { isOwnerReference } from "./participantUtils";
import { getDraftPendingStep } from "./recordUtils";

const STEP_LABELS = {
  1: "record.step.setup",
  2: "record.step.participants",
  3: "record.step.payer",
  4: "record.step.items",
  5: "record.step.split",
  6: "record.step.settle",
} as const;

type SettlementPerson = {
  participantId: string;
  name: string;
  isPayer: boolean;
  paidCents?: number;
  consumedCents?: number;
  netCents: number;
};

type SettlementResolver = (
  record: DraftRecord
) =>
  | ReturnType<typeof computeSettlement>
  | null
  | undefined;

function resolveSettlement(record: DraftRecord, resolver?: SettlementResolver) {
  if (resolver) {
    return resolver(record);
  }

  return computeSettlement(record.values);
}

export function formatAppMoney(
  amountCents: number,
  currency: string,
  locale: string,
  settings?: {
    customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
  }
) {
  const customCurrency = settings?.customCurrencies?.find(
    (entry) => entry.code.trim().toUpperCase() === currency.trim().toUpperCase()
  );
  if (customCurrency) {
    return `${customCurrency.symbol}${(amountCents / 100).toFixed(2)}`;
  }

  return formatMoney(amountCents, currency, locale);
}

export function getSettledParticipantIds(record: DraftRecord) {
  return new Set(record.settlementState?.settledParticipantIds ?? []);
}

export function getOwingPeople(people: SettlementPerson[]) {
  const payer = people.find((person) => person.isPayer);
  if (!payer || payer.netCents === 0) {
    return [];
  }

  const targetNetSign = payer.netCents > 0 ? -1 : 1;
  return people.filter((person) => !person.isPayer && Math.sign(person.netCents) === targetNetSign);
}

export function getOverviewSettlementLabel(person: { isPayer: boolean; netCents: number }) {
  if (person.isPayer) {
    return t("record.settlement.payer");
  }

  return person.netCents < 0
    ? t("record.settlement.owesPayer")
    : t("record.settlement.payerOwesThem");
}

export function getRecordMoneyPreview(record: DraftRecord, ownerName: string, resolver?: SettlementResolver) {
  const settlement = resolveSettlement(record, resolver);
  if (!settlement?.ok) {
    return null;
  }

  const payer = settlement.data.people.find((person) => person.isPayer);
  if (!payer) {
    return null;
  }

  const owner = settlement.data.people.find((person) => isOwnerReference(person.name, ownerName));
  const debtorPeople = getOwingPeople(settlement.data.people);
  const settledIds = getSettledParticipantIds(record);
  const totalDebtCents = debtorPeople.reduce((sum, person) => sum + Math.abs(person.netCents), 0);
  const settledDebtCents = debtorPeople.reduce(
    (sum, person) => sum + (settledIds.has(person.participantId) ? Math.abs(person.netCents) : 0),
    0
  );
  const unsettledDebtCents = Math.max(totalDebtCents - settledDebtCents, 0);

  if (!owner) {
    return {
      currency: settlement.data.currency,
      ownerNetCents: 0,
      ownerRelation: "none" as const,
      payerName: payer.name,
      totalDebtCents,
      settledDebtCents,
      unsettledDebtCents,
      debtorPeople,
    };
  }

  const ownerDebt = debtorPeople.find((person) => person.participantId === owner.participantId);
  const ownerRelation =
    owner.isPayer && payer.netCents !== 0
      ? payer.netCents > 0
        ? ("creditor" as const)
        : ("debtor" as const)
      : ownerDebt
        ? owner.netCents > 0
          ? ("creditor" as const)
          : ("debtor" as const)
        : ("none" as const);

  return {
    currency: settlement.data.currency,
    ownerNetCents:
      owner.isPayer
        ? unsettledDebtCents
        : ownerDebt && !settledIds.has(owner.participantId)
          ? Math.abs(ownerDebt.netCents)
          : 0,
    ownerRelation,
    payerName: payer.name,
    totalDebtCents,
    settledDebtCents,
    unsettledDebtCents,
    debtorPeople,
  };
}

export function getHomeBalanceCards(
  records: DraftRecord[],
  ownerName: string,
  preferredCurrency?: string,
  resolver?: SettlementResolver
) {
  const previews = records
    .map((record) => getRecordMoneyPreview(record, ownerName, resolver))
    .filter((preview): preview is NonNullable<ReturnType<typeof getRecordMoneyPreview>> => Boolean(preview));

  const totalsByCurrency = new Map<string, { owedCents: number; oweCents: number }>();

  for (const preview of previews) {
    const normalizedCurrency = preview.currency.trim().toUpperCase();
    const nextTotals = totalsByCurrency.get(normalizedCurrency) ?? { owedCents: 0, oweCents: 0 };

    if (preview.ownerRelation === "creditor") {
      nextTotals.owedCents += preview.ownerNetCents;
    }

    if (preview.ownerRelation === "debtor") {
      nextTotals.oweCents += preview.ownerNetCents;
    }

    totalsByCurrency.set(normalizedCurrency, nextTotals);
  }

  const preferredKey = preferredCurrency?.trim().toUpperCase() ?? "";
  const currency =
    (preferredKey && totalsByCurrency.has(preferredKey) ? preferredKey : null) ??
    previews[0]?.currency ??
    records[0]?.values.currency ??
    "USD";
  const totals = totalsByCurrency.get(currency.trim().toUpperCase()) ?? { owedCents: 0, oweCents: 0 };

  return { currency, owedCents: totals.owedCents, oweCents: totals.oweCents };
}

export function getRecentRowMeta(
  record: DraftRecord,
  ownerName: string,
  settings?: {
    splitListAmountDisplay?: SplitListAmountDisplay;
    customCurrencies?: Array<{ code: string; name: string; symbol: string }>;
  },
  resolver?: SettlementResolver
) {
  const preview = getRecordMoneyPreview(record, ownerName, resolver);
  const locale = getDeviceLocale();
  const currency = preview?.currency ?? record.values.currency;
  const settlement = resolveSettlement(record, resolver);
  const owner = settlement?.ok
    ? settlement.data.people.find((person) => isOwnerReference(person.name, ownerName))
    : null;
  const totalCents =
    settlement?.ok
      ? settlement.data.totalCents
      : record.values.items.reduce(
          (sum, item) => sum + (parseMoneyToCents(item.price) ?? 0),
          0,
        );
  const remainingBaseAmountCents = preview?.ownerNetCents ?? 0;
  const remainingRawAmountCents =
    preview?.ownerRelation === "debtor"
      ? -remainingBaseAmountCents
      : remainingBaseAmountCents;
  const remainingAmount = formatAppMoney(
    Math.abs(remainingRawAmountCents),
    currency,
    locale,
    settings,
  );
  const remainingLabel =
    remainingRawAmountCents < 0
      ? t("record.amount.owe")
      : remainingRawAmountCents > 0
        ? t("record.amount.owed")
        : t("record.amount.nothingDue");
  const totalAmount = formatAppMoney(totalCents, currency, locale, settings);
  const userPaidAmount = formatAppMoney(
    Math.max(owner?.consumedCents ?? 0, 0),
    currency,
    locale,
    settings,
  );
  const amountDisplayMode = settings?.splitListAmountDisplay ?? "remaining";
  const pendingStep = getDraftPendingStep(record);

  const amountDisplay =
    amountDisplayMode === "total"
      ? {
          variant: "total" as const,
          primaryLabel: t("record.amount.total"),
          primaryValue: totalAmount,
        }
      : amountDisplayMode === "userPaid"
        ? {
            variant: "userPaid" as const,
            primaryLabel: t("record.amount.userPaid"),
            primaryValue: userPaidAmount,
          }
        : amountDisplayMode === "totalAndRemaining"
          ? {
              variant: "totalAndRemaining" as const,
              primaryLabel: t("record.amount.total"),
              primaryValue: totalAmount,
              secondaryLabel: remainingLabel,
              secondaryValue: remainingAmount,
              secondaryKind:
                remainingRawAmountCents < 0
                  ? ("owe" as const)
                  : remainingRawAmountCents > 0
                    ? ("owed" as const)
                    : ("nothingDue" as const),
            }
          : {
              variant: "remaining" as const,
              primaryLabel: remainingLabel,
              primaryValue: remainingAmount,
              primaryKind:
                remainingRawAmountCents < 0
                  ? ("owe" as const)
                  : remainingRawAmountCents > 0
                    ? ("owed" as const)
                    : ("nothingDue" as const),
            };

  if (record.status === "completed") {
    return {
      amountDisplay,
      statusLabel: t("record.status.settled"),
      statusColor: PALETTE.secondary,
      showUnpaidDots: false,
    };
  }

  return {
    amountDisplay,
    statusLabel: t("record.status.pending", {
      step: t(STEP_LABELS[pendingStep as keyof typeof STEP_LABELS]),
    }),
    statusColor: PALETTE.primary,
    showUnpaidDots: false,
  };
}
